import crypto from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PRODUCTS_URL = "https://haokaopenapi.lot-ml.com/api/order/GetProductsV2";
const H5_BASE_URL = "https://haokawx.lot-ml.com";
const DATA_DIR = path.join(process.cwd(), ".data");
const SNAPSHOT_PATH = path.join(DATA_DIR, "haoka172-products-snapshot.json");
const ORDER_LINKS_SNAPSHOT_PATH = path.join(DATA_DIR, "haoka172-order-links-snapshot.json");
const EVENTS_PATH = path.join(DATA_DIR, "haoka172-product-events.jsonl");
const BUILTIN_ORDER_USER_ID = "5879e81e899912ce";
const MISSING_INACTIVE_THRESHOLD = Number(process.env.HAOKA172_MISSING_INACTIVE_THRESHOLD ?? 3);
const SYNC_MIN_INTERVAL_SECONDS = Number(process.env.HAOKA172_SYNC_MIN_INTERVAL_SECONDS ?? 1800);
const REQUEST_TIMEOUT_MS = Number(process.env.HAOKA172_TIMEOUT_MS ?? 8000);
const MAX_RETRIES = Number(process.env.HAOKA172_MAX_RETRIES ?? 2);
const FORCE_SYNC = process.argv.includes("--force") || process.env.HAOKA172_SYNC_FORCE === "1";

const broadbandWords = ["宽带", "单宽", "融合", "FTTR", "电视", "光猫"];
const mobileWords = ["流量", "通用", "定向", "手机卡", "电话卡", "月租", "选号", "通话"];

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
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

function normalizeProduct(raw) {
  const productID = Number(raw.productID);
  const productName = raw.productName || `套餐 ${productID}`;
  const skus = Array.isArray(raw.Skus) ? raw.Skus : [];
  const text = [
    productName,
    raw.area || "",
    raw.disableArea || "",
    raw.Taocan || "",
    raw.Rule || "",
    raw.PriceTime || "",
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
    BackMoneyType: raw.BackMoneyType || "",
    Taocan: raw.Taocan || "",
    Rule: raw.Rule || "",
    Age1: raw.Age1 ?? null,
    Age2: raw.Age2 ?? null,
    PriceTime: raw.PriceTime || "",
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

function diffFields(before, after) {
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

async function fetchProductsFrom172() {
  const userId = readEnv("HAOKA172_USER_ID");
  const secret = readEnv("HAOKA172_SECRET");
  const productId = process.env.HAOKA172_PRODUCT_ID ?? "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const userSign = md5(`ProductID=${productId}&Timestamp=${timestamp}&user_id=${userId}${secret}`);
    const form = new FormData();
    form.set("user_id", userId);
    form.set("Timestamp", timestamp);
    form.set("ProductID", productId);
    form.set("user_sign", userSign);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(PRODUCTS_URL, {
        method: "POST",
        body: form,
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.code === 0 && Array.isArray(payload.data)) {
        return payload.data.filter((item) => Number.isFinite(Number(item.productID)));
      }

      if (attempt < MAX_RETRIES && shouldRetryStatus(response.status)) {
        await sleep(retryDelayMs(response, attempt));
        continue;
      }

      throw new Error(`商品同步失败：HTTP ${response.status}，code=${payload?.code}，message=${payload?.message}`);
    } catch (error) {
      if (attempt < MAX_RETRIES) {
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
  return BUILTIN_ORDER_USER_ID;
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

async function fetchOrderLinks() {
  const userId = getOrderUserId();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const body = new URLSearchParams({
      title: "",
      PriceTime: "优惠时间",
      LiuLiang: "可用流量",
      Tonghua: "通话时长",
      Province: "全部",
      City: "全部",
      redbook: ""
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${H5_BASE_URL}/ProductEn/Index2/${encodeURIComponent(userId)}`, {
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

      if (response.ok && Array.isArray(payload?.data)) {
        return {
          userId,
          links: payload.data
            .map(toOrderLink)
            .filter(Boolean)
            .sort((a, b) => a.productID - b.productID)
        };
      }

      if (attempt < MAX_RETRIES && shouldRetryStatus(response.status)) {
        await sleep(retryDelayMs(response, attempt));
        continue;
      }

      throw new Error(`办理链接同步失败：HTTP ${response.status}，message=${payload?.message}`);
    } catch (error) {
      if (attempt < MAX_RETRIES) {
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

async function readSnapshot() {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
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

function buildNextSnapshot(previous, normalizedProducts, syncedAt) {
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
    const status = missingCount >= MISSING_INACTIVE_THRESHOLD ? "inactive_missing" : "missing";
    const productForEvent = {
      productID: previousProduct.productID,
      productName: previousProduct.productName,
      category: previousProduct.category
    };

    if (previousProduct.status !== "missing" && previousProduct.status !== "inactive_missing") {
      events.push(createEvent("product_missing", productForEvent, { missingCount, status }));
    } else if (previousProduct.status !== "inactive_missing" && status === "inactive_missing") {
      events.push(createEvent("product_inactive_missing", productForEvent, { missingCount, status }));
    }

    products[id] = {
      ...previousProduct,
      status,
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

  const rawProducts = await fetchProductsFrom172();
  const orderLinks = await fetchOrderLinks();
  const normalizedProducts = rawProducts.map(normalizeProduct);
  const { snapshot, events } = buildNextSnapshot(previous, normalizedProducts, syncedAt);

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf8");
  await writeFile(
    ORDER_LINKS_SNAPSHOT_PATH,
    JSON.stringify(
      {
        version: 1,
        syncedAt,
        userId: orderLinks.userId,
        total: orderLinks.links.length,
        links: orderLinks.links
      },
      null,
      2
    ),
    "utf8"
  );
  await writeEvents(events);

  const currentCategoryCount = countBy(Object.fromEntries(normalizedProducts.map((product) => [product.productID, product])), "category");
  const statusCount = countBy(snapshot.products, "status");

  console.log("商品同步完成");
  console.log("本次返回商品:", normalizedProducts.length);
  console.log("办理入口商品:", orderLinks.links.length);
  console.log("当前品类:", JSON.stringify(currentCategoryCount));
  console.log("历史状态:", JSON.stringify(statusCount));
  console.log("新增事件:", events.length);
  for (const event of events.slice(0, 8)) {
    console.log(`- ${event.type}: ${event.productID} ${event.productName}`);
  }
  if (events.length > 8) {
    console.log(`- 还有 ${events.length - 8} 条事件，见 ${EVENTS_PATH}`);
  }
  console.log("快照:", SNAPSHOT_PATH);
  console.log("办理入口快照:", ORDER_LINKS_SNAPSHOT_PATH);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
