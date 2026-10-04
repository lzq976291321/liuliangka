import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDefaultHaoka172Account } from "@/lib/haoka172-accounts";
import type { CatalogSourceState } from "@/lib/types";

type ProductEnCatalogItem = {
  productID?: number;
  id?: number;
  name?: string;
  shareUrl?: string;
  tuiPath?: string;
  isp?: string;
  nowPrice?: string;
  tyLiuliang?: string;
  dxLiuliang?: string;
  tonghua?: string;
  age1?: number;
  age2?: number;
};

type ProductEnCatalogResponse = {
  code: number;
  message?: string;
  data?: ProductEnCatalogItem[];
};

export type Haoka172OrderLink = {
  productID: number;
  productName: string;
  shareUrl: string;
  pudId?: string;
  userId?: string;
  operator?: string;
  monthlyRent?: string;
  generalDataGB?: string;
  directedDataGB?: string;
  callMinutes?: string;
  age1?: number;
  age2?: number;
  updatedAt?: string;
};

const H5_BASE_URL = "https://haokawx.lot-ml.com";
const ORDER_LINK_SNAPSHOT_PATH = path.join(process.cwd(), ".data", "haoka172-order-links-snapshot.json");
const CATALOG_SNAPSHOT_PATH = path.join(process.cwd(), ".data", "haoka172-catalog-snapshot.json");
const orderCatalogCache = new Map<string, { expiresAt: number; links: Map<number, Haoka172OrderLink> }>();
const orderCatalogInFlight = new Map<string, Promise<Map<number, Haoka172OrderLink>>>();
let orderLinksSourceState: CatalogSourceState = { status: "fallback" };

function recordSourceState(status: CatalogSourceState["status"], links: Map<number, Haoka172OrderLink>) {
  orderLinksSourceState = { status, checkedAt: new Date().toISOString(), updatedAt: [...links.values()].map((link) => link.updatedAt).filter((value): value is string => Boolean(value)).sort().at(-1) };
}

export function getOrderLinksSourceState() { return { ...orderLinksSourceState }; }

function getOrderLinkCacheTtlMs() {
  return Math.min(1800, Math.max(1, Number(process.env.HAOKA172_ORDER_LINK_CACHE_TTL_SECONDS) || 1800)) * 1000;
}

function getOrderLinkMaxRetries() {
  return Number(process.env.HAOKA172_ORDER_LINK_MAX_RETRIES ?? 2);
}

function getOrderLinkSnapshotMaxAgeMs() {
  return Math.min(1800, Math.max(1, Number(process.env.HAOKA172_ORDER_LINK_SNAPSHOT_MAX_AGE_SECONDS) || 1800)) * 1000;
}

export function getHaoka172OrderUserId() {
  return getDefaultHaoka172Account().orderUserId;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number) {
  return Math.min(3000, 300 * 2 ** attempt);
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function getShareUrl(item: ProductEnCatalogItem) {
  if (item.shareUrl) {
    return item.shareUrl;
  }

  if (item.tuiPath) {
    return new URL(item.tuiPath, H5_BASE_URL).toString();
  }

  return undefined;
}

function parseOrderUrl(shareUrl: string) {
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

function toOrderLink(item: ProductEnCatalogItem, updatedAt?: string): Haoka172OrderLink | undefined {
  const productID = Number(item.productID ?? item.id);
  const shareUrl = getShareUrl(item);

  if (!Number.isFinite(productID) || !shareUrl) {
    return undefined;
  }

  const parsed = parseOrderUrl(shareUrl);

  return {
    productID,
    updatedAt,
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

async function readOrderLinksFromSnapshot(userId: string, options: { allowStale?: boolean } = {}) {
  try {
    const bundle = await readFile(CATALOG_SNAPSHOT_PATH, "utf8").then((data) => JSON.parse(data)).catch(() => undefined);
    const snapshot = (bundle?.orderLinksSnapshot ?? JSON.parse(await readFile(ORDER_LINK_SNAPSHOT_PATH, "utf8"))) as {
      syncedAt?: string;
      userId?: string;
      links?: Haoka172OrderLink[];
    };
    const syncedAtMs = snapshot.syncedAt ? Date.parse(snapshot.syncedAt) : 0;
    const isFresh = syncedAtMs > 0 && Date.now() - syncedAtMs <= getOrderLinkSnapshotMaxAgeMs();

    if (snapshot.userId && snapshot.userId !== userId) {
      return undefined;
    }

    if (!isFresh && !options.allowStale) {
      return undefined;
    }

    if (!Array.isArray(snapshot.links) || !snapshot.links.length) {
      return undefined;
    }

    return new Map(snapshot.links.map((link) => [link.productID, { ...link, updatedAt: link.updatedAt ?? snapshot.syncedAt }]));
  } catch {
    return undefined;
  }
}

async function fetchOrderCatalog(userId: string) {
  const cached = orderCatalogCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.links;
  }

  const inFlight = orderCatalogInFlight.get(userId);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    let response: Response | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt <= getOrderLinkMaxRetries(); attempt += 1) {
      const body = new URLSearchParams({
        title: "",
        PriceTime: "优惠时间",
        LiuLiang: "可用流量",
        Tonghua: "通话时长",
        Province: "全部",
        City: "全部",
        redbook: ""
      });

      try {
        response = await fetch(`${H5_BASE_URL}/ProductEn/Index2/${encodeURIComponent(userId)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Referer: `${H5_BASE_URL}/ProductEn/Index/${encodeURIComponent(userId)}`,
            "User-Agent": "Mozilla/5.0"
          },
          body,
          signal: AbortSignal.timeout(Number(process.env.HAOKA172_TIMEOUT_MS ?? 8000)),
          cache: "no-store"
        });

        if (response.ok || !shouldRetryStatus(response.status) || attempt >= getOrderLinkMaxRetries()) {
          break;
        }
      } catch (error) {
        lastError = error;
        if (attempt >= getOrderLinkMaxRetries()) {
          break;
        }
      }

      await sleep(retryDelayMs(attempt));
    }

    if (!response) {
      throw lastError instanceof Error ? lastError : new Error("办理链接接口连接失败");
    }

    if (!response.ok) {
      throw new Error(`办理链接接口失败：HTTP ${response.status}`);
    }

    const payload = (await response.json()) as ProductEnCatalogResponse;
    if (payload.code !== 0 || !Array.isArray(payload.data) || !payload.data.length) {
      throw new Error(`办理链接接口失败：code=${payload.code}，有效数据为空或业务失败`);
    }

    const links = new Map<number, Haoka172OrderLink>(cached?.links ?? (await readOrderLinksFromSnapshot(userId, { allowStale: true })) ?? []);
    let validLiveLinks = 0;
    const updatedAt = new Date().toISOString();
    for (const item of payload.data) {
      const link = toOrderLink(item, updatedAt);
      if (link?.pudId && link.userId) {
        links.set(link.productID, link);
        validLiveLinks += 1;
      }
    }
    if (!validLiveLinks) throw new Error("办理目录没有有效链接，保留上次有效数据");
    recordSourceState("live", links);

    orderCatalogCache.set(userId, {
      expiresAt: Date.now() + getOrderLinkCacheTtlMs(),
      links
    });
    return links;
  })();

  orderCatalogInFlight.set(userId, request);

  try {
    return await request;
  } finally {
    orderCatalogInFlight.delete(userId);
  }
}

export async function getHaoka172OrderLink(productId: string | number) {
  const userId = getHaoka172OrderUserId();
  const productID = Number(productId);

  if (!userId || !Number.isFinite(productID)) {
    return undefined;
  }

  const links = await getHaoka172OrderLinks();
  return links.get(productID);
}

export async function getHaoka172OrderLinks() {
  const userId = getHaoka172OrderUserId();

  if (!userId) {
    return new Map<number, Haoka172OrderLink>();
  }
  const cached = orderCatalogCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.links;

  const snapshotLinks = await readOrderLinksFromSnapshot(userId);
  if (snapshotLinks?.size) {
    recordSourceState("snapshot", snapshotLinks);
    orderCatalogCache.set(userId, {
      expiresAt: Math.min(Date.now() + getOrderLinkCacheTtlMs(), Math.max(...[...snapshotLinks.values()].map((link) => Date.parse(link.updatedAt ?? "") + getOrderLinkSnapshotMaxAgeMs()).filter(Number.isFinite))),
      links: snapshotLinks
    });
    return snapshotLinks;
  }

  if (process.env.HAOKA172_DISABLE_LIVE_FETCH === "1") {
    const links = (await readOrderLinksFromSnapshot(userId, { allowStale: true })) ?? new Map<number, Haoka172OrderLink>();
    recordSourceState("fallback", links);
    return links;
  }

  try {
    return await fetchOrderCatalog(userId);
  } catch (error) {
    console.warn("haoka172_order_fetch_failed", error instanceof Error ? error.name : "UnknownError");
    const links = cached?.links ?? (await readOrderLinksFromSnapshot(userId, { allowStale: true })) ?? new Map<number, Haoka172OrderLink>();
    recordSourceState("fallback", links);
    orderCatalogCache.set(userId, { expiresAt: Date.now() + 60_000, links });
    return links;
  }
}

export async function getLastValidOrderLinkSnapshot() {
  return (await readOrderLinksFromSnapshot(getHaoka172OrderUserId(), { allowStale: true })) ?? new Map<number, Haoka172OrderLink>();
}
