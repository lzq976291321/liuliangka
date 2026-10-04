import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDefaultHaoka172Account, isPlaceholderHaoka172Secret } from "@/lib/haoka172-accounts";
import { deriveCities, deriveScenes, detectProductCategory, parseCallMinutes, parseData, parseIsLongTerm, parseMonthlyRent, parsePriceTime } from "@/lib/product-parser";
import type { CardProduct, CatalogSourceState, Operator } from "@/lib/types";

type Product172 = {
  productID: number;
  productName?: string;
  mainPic?: string;
  area?: string;
  disableArea?: string;
  littlepicture?: string;
  netAddr?: string;
  flag?: boolean;
  numberSel?: 0 | 1 | 2;
  operator?: Operator;
  BackMoneyType?: string;
  backMoneyType?: string;
  Taocan?: string;
  taocan?: string;
  Rule?: string;
  rule?: string;
  Age1?: number;
  age1?: number;
  Age2?: number;
  age2?: number;
  PriceTime?: string;
  priceTime?: string;
  Skus?: Array<{ SkuID: number; SkuName: string; Desc: string }> | null;
  skus?: Array<{ SkuID: number; SkuName: string; Desc: string }> | null;
};

type ProductsResponse = {
  data?: Product172[];
  code: number;
  message: string;
  errs?: unknown;
};

const PRODUCTS_URL = "https://haokaopenapi.lot-ml.com/api/order/GetProductsV2";
const SNAPSHOT_PATH = path.join(process.cwd(), ".data", "haoka172-products-snapshot.json");
const CATALOG_SNAPSHOT_PATH = path.join(process.cwd(), ".data", "haoka172-catalog-snapshot.json");
const fallbackImage = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80";
const productCache = new Map<string, { expiresAt: number; products: CardProduct[] }>();
const productInFlight = new Map<string, Promise<CardProduct[]>>();
let productsSourceState: CatalogSourceState = { status: "fallback" };

function recordSourceState(status: CatalogSourceState["status"], products: CardProduct[]) {
  productsSourceState = { status, checkedAt: new Date().toISOString(), updatedAt: products.map((product) => product.updatedAt).filter((value): value is string => Boolean(value)).sort().at(-1) };
}

export function getProductsSourceState() { return { ...productsSourceState }; }

function getCacheTtlMs() {
  return Math.min(1800, Math.max(1, Number(process.env.HAOKA172_CACHE_TTL_SECONDS) || 1800)) * 1000;
}

function getTimeoutMs() {
  return Number(process.env.HAOKA172_TIMEOUT_MS ?? 8000);
}

function getMaxRetries() {
  return Number(process.env.HAOKA172_MAX_RETRIES ?? 2);
}

function getSnapshotMaxAgeMs() {
  return Math.min(1800, Math.max(1, Number(process.env.HAOKA172_SNAPSHOT_MAX_AGE_SECONDS) || 1800)) * 1000;
}

function md5(value: string) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function signGetProducts(params: { ProductID: string; Timestamp: string; user_id: string }, secret: string) {
  return md5(`ProductID=${params.ProductID}&Timestamp=${params.Timestamp}&user_id=${params.user_id}${secret}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelayMs(response: Response | undefined, attempt: number) {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(30_000, seconds * 1000);
    }
  }

  return Math.min(5000, 400 * 2 ** attempt);
}

export function normalize172Product(product: Product172, updatedAt?: string): CardProduct {
  const productName = product.productName || `套餐 ${product.productID}`;
  const taocan = product.Taocan || product.taocan || "";
  const rule = product.Rule || product.rule || "";
  const rawPriceTime = product.PriceTime || product.priceTime || "";
  const area = product.area || "待确认";
  const backMoneyType = product.BackMoneyType || product.backMoneyType || "待确认";
  const operator = product.operator || "电信";
  const age1 = product.Age1 ?? product.age1;
  const age2 = product.Age2 ?? product.age2;
  const skus = product.Skus ?? product.skus ?? [];
  const normalizedSkus = Array.isArray(skus) ? skus : [];
  const fullText = [
    productName,
    area,
    product.disableArea || "",
    taocan,
    rule,
    rawPriceTime,
    normalizedSkus.map((sku) => `${sku.SkuName} ${sku.Desc}`).join(" ")
  ].join(" ");
  const availabilityText = [productName, area, taocan, rule, rawPriceTime, normalizedSkus.map((sku) => `${sku.SkuName} ${sku.Desc}`).join(" ")].join(" ");
  const priceTime = rawPriceTime || parsePriceTime(fullText, "待确认");
  const monthlyRent = parseMonthlyRent(fullText);
  const data = parseData(fullText);
  const callMinutes = parseCallMinutes(fullText);
  const isLongTerm = parseIsLongTerm(priceTime) ?? parseIsLongTerm(fullText);
  const category = detectProductCategory(fullText);

  return {
    productID: product.productID,
    updatedAt,
    factSources: Object.fromEntries(Object.entries({
      monthlyRent,
      dataGB: data.total,
      generalDataGB: data.general,
      directedDataGB: data.directed,
      callMinutes,
      isLongTerm
    }).filter(([, value]) => value !== undefined).map(([field]) => [field, "套餐文本"])),
    productName,
    mainPic: product.mainPic || product.littlepicture || fallbackImage,
    area,
    disableArea: product.disableArea ? product.disableArea.split(/[,，、]/).filter(Boolean) : [],
    littlepicture: product.littlepicture,
    netAddr: product.netAddr,
    flag: Boolean(product.flag),
    numberSel: product.numberSel ?? 0,
    operator,
    backMoneyType,
    taocan,
    rule,
    eligibilityText: availabilityText,
    age1,
    age2,
    priceTime,
    skus: normalizedSkus.map((sku) => ({
      id: sku.SkuID,
      name: sku.SkuName,
      description: sku.Desc
    })),
    monthlyRent,
    dataGB: data.total,
    generalDataGB: data.general,
    directedDataGB: data.directed,
    callMinutes,
    commission: 0,
    category,
    status: product.flag ? "active" : "inactive",
    isLongTerm,
    priority: 50,
    tags: [operator, priceTime, backMoneyType].filter(Boolean),
    scenes: deriveScenes({
      text: fullText,
      monthlyRent,
      dataGB: data.total,
      callMinutes,
      age1,
      age2,
      isLongTerm
    }),
    cities: deriveCities(availabilityText),
    warnings: ["套餐信息可能不完整，办理前请以办理页为准"],
    applyUrl: product.netAddr || "#apply-panel"
  };
}

async function readProductsFromSnapshot(productId: string, options: { allowStale?: boolean } = {}): Promise<CardProduct[] | undefined> {
  try {
    const bundle = await readFile(CATALOG_SNAPSHOT_PATH, "utf8").then((data) => JSON.parse(data)).catch(() => undefined);
    const snapshot = (bundle?.productsSnapshot ?? JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"))) as {
      syncedAt?: string;
      products?: Record<
        string,
        {
          status?: string;
          lastSeenAt?: string;
          raw?: Product172;
        }
      >;
    };
    const syncedAtMs = snapshot.syncedAt ? Date.parse(snapshot.syncedAt) : 0;
    const isFresh = syncedAtMs > 0 && Date.now() - syncedAtMs <= getSnapshotMaxAgeMs();

    if (!isFresh && !options.allowStale) {
      return undefined;
    }

    const products = Object.values(snapshot.products ?? {})
      .filter((item) => item.status === "active" && item.raw)
      .map((item) => normalize172Product(item.raw as Product172, item.lastSeenAt ?? snapshot.syncedAt));

    if (!products.length) {
      return undefined;
    }

    if (productId) {
      return products.filter((product) => String(product.productID) === productId);
    }

    return products;
  } catch {
    return undefined;
  }
}

function createProductsForm(userId: string, secret: string, productId: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = {
    ProductID: productId,
    Timestamp: timestamp,
    user_id: userId
  };
  const form = new FormData();
  form.set("user_id", userId);
  form.set("Timestamp", timestamp);
  form.set("ProductID", productId);
  form.set("user_sign", signGetProducts(params, secret));
  return form;
}

async function postProducts(userId: string, secret: string, productId: string) {
    return fetch(PRODUCTS_URL, {
      method: "POST",
      body: createProductsForm(userId, secret, productId),
      signal: AbortSignal.timeout(getTimeoutMs()),
      cache: "no-store"
    });
}

async function fetchProductsFrom172(productId: string): Promise<CardProduct[]> {
  const account = getDefaultHaoka172Account();
  const userId = account.productUserId;
  const secret = account.productSecret;
  const targetProductId = productId || account.productId || "";

  if (!userId || isPlaceholderHaoka172Secret(secret)) {
    return [];
  }

  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= getMaxRetries(); attempt += 1) {
    try {
      const response = await postProducts(userId, secret, targetProductId);
      lastResponse = response;

      if (!response.ok) {
        if (attempt < getMaxRetries() && shouldRetryStatus(response.status)) {
          await sleep(retryDelayMs(response, attempt));
          continue;
        }
        break;
      }

      const payload = (await response.json()) as ProductsResponse;
      if (payload.code !== 0 || !payload.data?.length) {
        lastError = new Error(`商品接口业务失败：code=${payload.code}`);
        break;
      }
      if (payload.data.some((product) => !Number.isInteger(Number(product.productID)) || Number(product.productID) <= 0) || new Set(payload.data.map((product) => Number(product.productID))).size !== payload.data.length) {
        lastError = new Error("商品接口标识无效或重复");
        break;
      }

      const updatedAt = new Date().toISOString();
      return payload.data.map((product) => normalize172Product(product, updatedAt));
    } catch (error) {
      lastError = error;
      if (attempt < getMaxRetries()) {
        await sleep(retryDelayMs(undefined, attempt));
        continue;
      }
    }
  }

  console.warn(
    "haoka172_fetch_failed",
    JSON.stringify({
      productId,
      status: lastResponse?.status,
      error: lastError instanceof Error ? lastError.message : String(lastError ?? "")
    })
  );
  return [];
}

export async function getProductsFrom172(productId = ""): Promise<CardProduct[]> {
  const cacheKey = productId || "all";
  const cached = productCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.products;
  }

  const snapshotProducts = await readProductsFromSnapshot(productId);
  if (snapshotProducts?.length) {
    recordSourceState("snapshot", snapshotProducts);
    productCache.set(cacheKey, {
      products: snapshotProducts,
      expiresAt: Math.min(Date.now() + getCacheTtlMs(), Math.max(...snapshotProducts.map((product) => Date.parse(product.updatedAt ?? "") + getSnapshotMaxAgeMs()).filter(Number.isFinite)))
    });
    return snapshotProducts;
  }

  if (process.env.HAOKA172_DISABLE_LIVE_FETCH === "1") {
    const products = (await readProductsFromSnapshot(productId, { allowStale: true })) ?? [];
    recordSourceState("fallback", products);
    return products;
  }

  const pending = productInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = fetchProductsFrom172(productId)
    .then(async (products) => {
      const previous = cached?.products ?? (await readProductsFromSnapshot(productId, { allowStale: true })) ?? [];
      // 无分页总数契约时，列表缺失不等于下架；保留旧条目的旧更新时间。
      const merged = new Map(previous.map((product) => [product.productID, product]));
      for (const product of products) merged.set(product.productID, product);
      const result = products.length ? [...merged.values()] : previous;
      recordSourceState(products.length ? "live" : "fallback", result);
      productCache.set(cacheKey, {
        products: result,
        expiresAt: Date.now() + (products.length ? getCacheTtlMs() : 60_000)
      });
      return result;
    })
    .catch((error) => {
      recordSourceState("fallback", cached?.products ?? []);
      console.warn("haoka172_cache_fallback", error instanceof Error ? error.message : String(error));
      return cached?.products ?? [];
    })
    .finally(() => {
      productInFlight.delete(cacheKey);
    });

  productInFlight.set(cacheKey, request);
  return request;
}

export async function getAllProducts() {
  return getProductsFrom172("");
}

export async function getLastValidProductSnapshot() {
  return (await readProductsFromSnapshot("", { allowStale: true })) ?? [];
}

export async function getProductById(productId: string) {
  const products = await getAllProducts();
  return products.find((product) => String(product.productID) === productId);
}
