import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { appendFile, chmod, copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PRODUCTS_URL = "https://haokaopenapi.lot-ml.com/api/order/GetProductsV2";
const H5_BASE_URL = "https://haokawx.lot-ml.com";
const DATA_DIR = path.join(process.cwd(), ".data");
const SNAPSHOT_PATH = path.join(DATA_DIR, "haoka172-products-snapshot.json");
const ORDER_LINKS_SNAPSHOT_PATH = path.join(DATA_DIR, "haoka172-order-links-snapshot.json");
const CATALOG_SNAPSHOT_PATH = path.join(DATA_DIR, "haoka172-catalog-snapshot.json");
const EVENTS_PATH = path.join(DATA_DIR, "haoka172-product-events.jsonl");
const ACCOUNTS_CONFIG_PATH = path.join(process.cwd(), "config", "haoka172-accounts.json");
const SYNC_MIN_INTERVAL_SECONDS = Number(process.env.HAOKA172_SYNC_MIN_INTERVAL_SECONDS ?? 1800);
const REQUEST_TIMEOUT_MS = Number(process.env.HAOKA172_TIMEOUT_MS ?? 8000);
const MAX_RETRIES = Number(process.env.HAOKA172_MAX_RETRIES ?? 2);
const FORCE_SYNC = process.argv.includes("--force") || process.env.HAOKA172_SYNC_FORCE === "1";

const broadbandWords = ["宽带", "单宽", "融合", "FTTR", "电视", "光猫"];
const mobileWords = ["流量", "通用", "定向", "手机卡", "电话卡", "月租", "选号", "通话"];
let accountsConfigCache;

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readAccountsConfig() {
  if (accountsConfigCache) {
    return accountsConfigCache;
  }

  accountsConfigCache = JSON.parse(readFileSync(ACCOUNTS_CONFIG_PATH, "utf8"));
  return accountsConfigCache;
}

function getCliOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function isPlaceholderSecret(value) {
  return !value || /\*|REPLACE_WITH_|REDACT|hidden/i.test(value);
}

function getSelectedAccount() {
  const config = readAccountsConfig();
  const accountId = getCliOption("--account") || config.defaultAccountId;
  const account = config.accounts?.find((item) => item.id === accountId);

  if (!account?.productUserId || !account.orderUserId) {
    throw new Error("172 账号配置无效");
  }

  if (isPlaceholderSecret(account.productSecret)) {
    throw new Error("172 商品接口密钥未配置有效值");
  }

  return account;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelayMs(response, attempt) {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(30_000, seconds * 1000);
    }
  }

  return Math.min(5000, 400 * 2 ** attempt);
}

function detectProductCategory(text) {
  const hasBroadbandWord = broadbandWords.some((word) => text.includes(word));
  const hasMobileWord = mobileWords.some((word) => text.includes(word));
  const hasMobileData = /\d+(?:\.\d+)?\s*G/i.test(text);

  if (hasBroadbandWord && !hasMobileData) {
    return "broadband";
  }

  if (hasBroadbandWord && /(?:单宽|宽带包年|宽带\d+M|\d+M.*宽带)/i.test(text)) {
    return "broadband";
  }

  if (/\d+(?:\.\d+)?\s*M/i.test(text) && !hasMobileData) {
    return "broadband";
  }

  if (hasMobileWord || hasMobileData) {
    return "mobile-card";
  }

  return "unknown";
}

export function normalizeProduct(raw) {
  const productID = Number(raw.productID);
  const productName = raw.productName || `套餐 ${productID}`;
  const rawSkus = raw.Skus ?? raw.skus;
  const skus = Array.isArray(rawSkus) ? rawSkus : [];
  const text = [
    productName,
    raw.area || "",
    raw.disableArea || "",
    raw.Taocan || raw.taocan || "",
    raw.Rule || raw.rule || "",
    raw.PriceTime || raw.priceTime || "",
    skus.map((sku) => `${sku.SkuName || ""} ${sku.Desc || ""}`).join(" ")
  ].join(" ");

  const compareFields = {
    productID,
    productName,
    mainPic: raw.mainPic || "",
    littlepicture: raw.littlepicture || "",
    netAddr: raw.netAddr || "",
    flag: Boolean(raw.flag),
    numberSel: raw.numberSel ?? 0,
    operator: raw.operator || "",
    area: raw.area || "",
    disableArea: raw.disableArea || "",
    BackMoneyType: raw.BackMoneyType || raw.backMoneyType || "",
    Taocan: raw.Taocan || raw.taocan || "",
    Rule: raw.Rule || raw.rule || "",
    Age1: raw.Age1 ?? raw.age1 ?? null,
    Age2: raw.Age2 ?? raw.age2 ?? null,
    PriceTime: raw.PriceTime || raw.priceTime || "",
    Skus: skus.map((sku) => ({
      SkuID: sku.SkuID,
      SkuName: sku.SkuName || "",
      Desc: sku.Desc || ""
    })),
    category: detectProductCategory(text)
  };

  return {
    productID,
    productName,
    flag: compareFields.flag,
    category: compareFields.category,
    hash: sha256(JSON.stringify(compareFields)),
    compareFields,
    raw
  };
}

export function diffFields(before, after) {
  if (!before) {
    return Object.keys(after);
  }

  const changed = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}

export async function fetchProductsFrom172(options = {}) {
  const account = options.account ?? getSelectedAccount();
  const userId = account.productUserId;
  const secret = account.productSecret;
  const productId = options.productId ?? account.productId ?? "";
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const fetchImpl = options.fetchImpl ?? fetch;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const userSign = md5(`ProductID=${productId}&Timestamp=${timestamp}&user_id=${userId}${secret}`);
    const form = new FormData();
    form.set("user_id", userId);
    form.set("Timestamp", timestamp);
    form.set("ProductID", productId);
    form.set("user_sign", userSign);
    for (const [key, value] of Object.entries(options.extraParams ?? {})) form.set(key, String(value));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

    try {
      const response = await fetchImpl(PRODUCTS_URL, {
        method: "POST",
        body: form,
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      options.onDiagnostic?.(sourceDiagnostic("products", response, payload));

      if (response.ok && payload?.code === 0 && Array.isArray(payload.data) && payload.data.length) {
        const products = payload.data.filter((item) => Number.isInteger(Number(item.productID)) && Number(item.productID) > 0);
        if (products.length !== payload.data.length) throw new Error("商品接口包含无效商品标识，保留上次有效快照");
        return products;
      }

      if (attempt < maxRetries && shouldRetryStatus(response.status)) {
        await sleep(retryDelayMs(response, attempt));
        continue;
      }

      throw new Error(`商品同步失败：HTTP ${response.status}，code=${payload?.code ?? "unknown"}，数据为空或业务失败`);
    } catch (error) {
      if (attempt < maxRetries) {
        await sleep(retryDelayMs(undefined, attempt));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("商品同步失败：超过最大重试次数");
}

function getOrderUserId() {
  return getSelectedAccount().orderUserId;
}

function getShareUrl(item) {
  if (item.shareUrl) {
    return item.shareUrl;
  }

  if (item.tuiPath) {
    return new URL(item.tuiPath, H5_BASE_URL).toString();
  }

  return undefined;
}

function parseOrderUrl(shareUrl) {
  try {
    const url = new URL(shareUrl, H5_BASE_URL);
    return {
      pudId: url.searchParams.get("pudID") || undefined,
      userId: url.searchParams.get("userid") || undefined,
      shareUrl: url.toString()
    };
  } catch {
    return {
      pudId: undefined,
      userId: undefined,
      shareUrl
    };
  }
}

function toOrderLink(item) {
  const productID = Number(item.productID ?? item.id);
  const shareUrl = getShareUrl(item);

  if (!Number.isFinite(productID) || !shareUrl) {
    return undefined;
  }

  const parsed = parseOrderUrl(shareUrl);

  return {
    productID,
    productName: item.name || `套餐 ${productID}`,
    shareUrl: parsed.shareUrl,
    pudId: parsed.pudId,
    userId: parsed.userId,
    operator: item.isp,
    monthlyRent: item.nowPrice,
    generalDataGB: item.tyLiuliang,
    directedDataGB: item.dxLiuliang,
    callMinutes: item.tonghua,
    age1: item.age1,
    age2: item.age2
  };
}

export async function fetchOrderLinks(options = {}) {
  const userId = options.account?.orderUserId ?? getOrderUserId();
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const fetchImpl = options.fetchImpl ?? fetch;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const body = new URLSearchParams({
      title: "",
      PriceTime: "优惠时间",
      LiuLiang: "可用流量",
      Tonghua: "通话时长",
      Province: "全部",
      City: "全部",
      redbook: ""
    });
    for (const [key, value] of Object.entries(options.extraParams ?? {})) body.set(key, String(value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

    try {
      const response = await fetchImpl(`${H5_BASE_URL}/ProductEn/Index2/${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: `${H5_BASE_URL}/ProductEn/Index/${encodeURIComponent(userId)}`,
          "User-Agent": "Mozilla/5.0"
        },
        body,
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      options.onDiagnostic?.(sourceDiagnostic("orderCatalog", response, payload));

      if (response.ok && payload?.code === 0 && Array.isArray(payload?.data) && payload.data.length) {
        const links = payload.data.map(toOrderLink).filter((link) => link && link.pudId && link.userId).sort((a, b) => a.productID - b.productID);
        if (!links.length) throw new Error("办理接口无有效办理链接，保留上次有效快照");
        return {
          userId,
          links
        };
      }

      if (attempt < maxRetries && shouldRetryStatus(response.status)) {
        await sleep(retryDelayMs(response, attempt));
        continue;
      }

      throw new Error(`办理链接同步失败：HTTP ${response.status}，code=${payload?.code ?? "unknown"}，数据为空或业务失败`);
    } catch (error) {
      if (attempt < maxRetries) {
        await sleep(retryDelayMs(undefined, attempt));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("办理链接同步失败：超过最大重试次数");
}

export async function readSnapshot(dataDir = DATA_DIR) {
  try {
    const bundle = await readFile(path.join(dataDir, "haoka172-catalog-snapshot.json"), "utf8").then(JSON.parse).catch(() => undefined);
    return bundle?.productsSnapshot ?? JSON.parse(await readFile(path.join(dataDir, "haoka172-products-snapshot.json"), "utf8"));
  } catch {
    return {
      version: 1,
      syncedAt: null,
      totalLatest: 0,
      products: {}
    };
  }
}

function createEvent(type, product, details = {}) {
  return {
    type,
    productID: product.productID,
    productName: product.productName,
    category: product.category,
    createdAt: new Date().toISOString(),
    details
  };
}

export function buildNextSnapshot(previous, normalizedProducts, syncedAt) {
  const events = [];
  const currentMap = new Map(normalizedProducts.map((product) => [String(product.productID), product]));
  const products = { ...(previous.products || {}) };

  for (const product of normalizedProducts) {
    const id = String(product.productID);
    const previousProduct = products[id];
    const currentStatus = product.flag ? "active" : "inactive";

    if (!previousProduct) {
      events.push(createEvent("product_added", product, { status: currentStatus }));
      products[id] = {
        productID: product.productID,
        productName: product.productName,
        category: product.category,
        status: currentStatus,
        firstSeenAt: syncedAt,
        lastSeenAt: syncedAt,
        presence: "confirmed",
        missingCount: 0,
        hash: product.hash,
        compareFields: product.compareFields,
        raw: product.raw
      };
      continue;
    }

    if (previousProduct.status === "missing" || previousProduct.status === "inactive_missing") {
      events.push(
        createEvent("product_reappeared", product, {
          previousStatus: previousProduct.status,
          missingCount: previousProduct.missingCount ?? 0
        })
      );
    }

    if (previousProduct.status !== currentStatus && previousProduct.status !== "missing" && previousProduct.status !== "inactive_missing") {
      events.push(
        createEvent(currentStatus === "active" ? "product_active" : "product_inactive", product, {
          previousStatus: previousProduct.status,
          status: currentStatus
        })
      );
    }

    if (previousProduct.hash && previousProduct.hash !== product.hash) {
      const changedFields = diffFields(previousProduct.compareFields, product.compareFields);
      events.push(createEvent("product_changed", product, { changedFields }));
    }

    products[id] = {
      ...previousProduct,
      productID: product.productID,
      productName: product.productName,
      category: product.category,
      status: currentStatus,
      lastSeenAt: syncedAt,
      presence: "confirmed",
      missingCount: 0,
      hash: product.hash,
      compareFields: product.compareFields,
      raw: product.raw
    };
  }

  for (const [id, previousProduct] of Object.entries(previous.products || {})) {
    if (currentMap.has(id)) {
      continue;
    }

    const missingCount = (previousProduct.missingCount ?? 0) + 1;
    // 接口没有分页/总数契约。列表缺失不证明下架，也不能刷新其事实时间。
    const status = previousProduct.status;
    const productForEvent = {
      productID: previousProduct.productID,
      productName: previousProduct.productName,
      category: previousProduct.category
    };

    if (previousProduct.presence !== "unconfirmed") events.push(createEvent("product_missing", productForEvent, { missingCount, status, confirmedInactive: false }));

    products[id] = {
      ...previousProduct,
      status,
      presence: "unconfirmed",
      missingCount,
      lastMissingAt: syncedAt
    };
  }

  return {
    snapshot: {
      version: 1,
      syncedAt,
      totalLatest: normalizedProducts.length,
      products
    },
    events
  };
}

async function writeEvents(events) {
  if (!events.length) {
    return;
  }

  await appendFile(EVENTS_PATH, events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf8");
}

function countBy(products, field) {
  return Object.values(products).reduce((result, product) => {
    const key = product[field] || "unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function sourceDiagnostic(endpoint, response, payload) {
  const pagination = {};
  for (const key of ["total", "totalCount", "count", "page", "pageIndex", "pageSize", "hasMore", "hasNextPage"]) {
    if (typeof payload?.[key] === "number" || typeof payload?.[key] === "boolean") pagination[key] = payload[key];
  }
  return {
    endpoint,
    checkedAt: new Date().toISOString(),
    httpStatus: response.status,
    businessCode: typeof payload?.code === "number" ? payload.code : null,
    recordCount: Array.isArray(payload?.data) ? payload.data.length : 0,
    responseDate: response.headers.get("date"),
    pagination
  };
}

export function validateCatalogPair(rawProducts, orderLinks) {
  if (!rawProducts?.length || !orderLinks?.links?.length) throw new Error("商品或办理目录为空，保留上次有效快照");
  if (orderLinks.links.some((link) => !link.shareUrl || !link.pudId || !link.userId)) throw new Error("办理目录缺少有效办理参数");
  const productIds = rawProducts.map((product) => Number(product.productID));
  const linkIds = orderLinks.links.map((link) => Number(link.productID));
  if ([...productIds, ...linkIds].some((id) => !Number.isInteger(id) || id <= 0)) throw new Error("源数据包含无效商品标识");
  if (new Set(productIds).size !== productIds.length || new Set(linkIds).size !== linkIds.length) throw new Error("源数据包含重复商品标识，不能确认完整性");
  const products = new Set(productIds);
  const overlapIds = linkIds.filter((id) => products.has(id));
  if (!overlapIds.length) throw new Error("两源没有匹配商品，保留上次有效快照");
  return { productCount: productIds.length, orderLinkCount: linkIds.length, overlapCount: overlapIds.length, overlapIds, listingCompleteness: "unverified" };
}

export async function atomicWriteJson(filePath, value) {
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporaryPath, filePath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

export async function readOrderSnapshot(dataDir = DATA_DIR) {
  const bundle = await readFile(path.join(dataDir, "haoka172-catalog-snapshot.json"), "utf8").then(JSON.parse).catch(() => undefined);
  return bundle?.orderLinksSnapshot ?? await readFile(path.join(dataDir, "haoka172-order-links-snapshot.json"), "utf8").then(JSON.parse).catch(() => ({ links: [] }));
}

export async function saveSourceSnapshots(rawProducts, orderLinks, options = {}) {
  // 必须在创建任何新快照前完成两源验证。
  const validation = validateCatalogPair(rawProducts, orderLinks);
  const dataDir = options.dataDir ?? DATA_DIR;
  const syncedAt = options.syncedAt ?? new Date().toISOString();
  const [previous, previousOrders] = await Promise.all([readSnapshot(dataDir), readOrderSnapshot(dataDir)]);
  const byProductId = new Map(rawProducts.map((product) => [Number(product.productID), product]));
  for (const product of options.verifiedProducts ?? []) byProductId.set(Number(product.productID), product);
  const { snapshot, events } = buildNextSnapshot(previous, [...byProductId.values()].map(normalizeProduct), syncedAt);
  snapshot.totalLatest = rawProducts.length;
  snapshot.listingCompleteness = validation.listingCompleteness;
  snapshot.verifiedAdditionalCount = byProductId.size - rawProducts.length;
  const links = new Map((previousOrders.userId === orderLinks.userId ? previousOrders.links ?? [] : []).map((link) => [link.productID, { ...link, updatedAt: link.updatedAt ?? previousOrders.syncedAt, presence: "unconfirmed" }]));
  for (const link of orderLinks.links) links.set(link.productID, { ...link, updatedAt: syncedAt, presence: "confirmed" });
  const orderLinksSnapshot = { version: 2, syncedAt, userId: orderLinks.userId, total: links.size, totalLatest: orderLinks.links.length, listingCompleteness: "unverified", links: [...links.values()] };
  await mkdir(dataDir, { recursive: true });
  const backupDir = path.join(dataDir, "backups", `${syncedAt.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`);
  await mkdir(backupDir, { recursive: true });
  for (const name of ["haoka172-products-snapshot.json", "haoka172-order-links-snapshot.json", "haoka172-catalog-snapshot.json"]) {
    try {
      await copyFile(path.join(dataDir, name), path.join(backupDir, name));
      await chmod(path.join(backupDir, name), 0o600);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const bundle = { version: 2, syncedAt, productsSnapshot: snapshot, orderLinksSnapshot };
  await atomicWriteJson(path.join(dataDir, "haoka172-catalog-snapshot.json"), bundle);
  // 运行时只认上面一次原子切换的bundle；下列单文件为旧工具兼容导出。
  const compatibilityWrites = await Promise.allSettled([
    atomicWriteJson(path.join(dataDir, "haoka172-products-snapshot.json"), snapshot),
    atomicWriteJson(path.join(dataDir, "haoka172-order-links-snapshot.json"), orderLinksSnapshot)
  ]);
  let eventsWritten = true;
  if (events.length) {
    try { await appendFile(path.join(dataDir, "haoka172-product-events.jsonl"), events.map((event) => JSON.stringify(event)).join("\n") + "\n", { encoding: "utf8", mode: 0o600 }); }
    catch { eventsWritten = false; }
  }
  return {
    ...validation,
    syncedAt,
    backupDir,
    activeHistoricalCount: Object.values(snapshot.products).filter((product) => product.status === "active").length,
    unconfirmedHistoricalCount: Object.values(snapshot.products).filter((product) => product.presence === "unconfirmed").length,
    verifiedAdditionalCount: snapshot.verifiedAdditionalCount,
    compatibilityWritesOk: compatibilityWrites.every((result) => result.status === "fulfilled"),
    events: events.length,
    eventsWritten
  };
}

async function main() {
  const syncedAt = new Date().toISOString();
  const previous = await readSnapshot();
  const lastSyncedAtMs = previous.syncedAt ? Date.parse(previous.syncedAt) : 0;
  const elapsedSeconds = lastSyncedAtMs ? Math.floor((Date.now() - lastSyncedAtMs) / 1000) : Infinity;

  if (!FORCE_SYNC && elapsedSeconds < SYNC_MIN_INTERVAL_SECONDS) {
    console.log("跳过同步：距离上次同步过近");
    console.log("上次同步:", previous.syncedAt);
    console.log("已间隔秒数:", elapsedSeconds);
    console.log("最小间隔秒数:", SYNC_MIN_INTERVAL_SECONDS);
    console.log("强制同步:", "npm run sync:products -- --force");
    return;
  }

  const [rawProducts, orderLinks] = await Promise.all([fetchProductsFrom172(), fetchOrderLinks()]);
  const result = await saveSourceSnapshots(rawProducts, orderLinks, { syncedAt: new Date().toISOString() });
  console.log("商品同步完成", JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
