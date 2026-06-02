import { getDefaultHaoka172Account } from "@/lib/haoka172-accounts";

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
};

const H5_BASE_URL = "https://haokawx.lot-ml.com";
const ORDER_LINK_SNAPSHOT_PATH = path.join(process.cwd(), ".data", "haoka172-order-links-snapshot.json");
const orderCatalogCache = new Map<string, { expiresAt: number; links: Map<number, Haoka172OrderLink> }>();
const orderCatalogInFlight = new Map<string, Promise<Map<number, Haoka172OrderLink>>>();

function getOrderLinkCacheTtlMs() {
  return Number(process.env.HAOKA172_ORDER_LINK_CACHE_TTL_SECONDS ?? 600) * 1000;
}

function getOrderLinkMaxRetries() {
  return Number(process.env.HAOKA172_ORDER_LINK_MAX_RETRIES ?? 4);
}

function getOrderLinkSnapshotMaxAgeMs() {
  return Number(process.env.HAOKA172_ORDER_LINK_SNAPSHOT_MAX_AGE_SECONDS ?? 129600) * 1000;
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

function toOrderLink(item: ProductEnCatalogItem): Haoka172OrderLink | undefined {
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

async function readOrderLinksFromSnapshot(userId: string, options: { allowStale?: boolean } = {}) {
  try {
    const snapshot = JSON.parse(await readFile(ORDER_LINK_SNAPSHOT_PATH, "utf8")) as {
      syncedAt?: string;
      userId?: string;
      links?: Haoka172OrderLink[];
    };
    const syncedAtMs = snapshot.syncedAt ? Date.parse(snapshot.syncedAt) : 0;
    const isFresh = syncedAtMs > 0 && Date.now() - syncedAtMs <= getOrderLinkSnapshotMaxAgeMs();

    if (snapshot.userId && snapshot.userId !== userId) {
      return undefined;
    }

    if (!isFresh && !options.allowStale && process.env.HAOKA172_ALLOW_STALE_SNAPSHOT !== "1") {
      return undefined;
    }

    if (!Array.isArray(snapshot.links) || !snapshot.links.length) {
      return undefined;
    }

    return new Map(snapshot.links.map((link) => [link.productID, link]));
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
    if (!Array.isArray(payload.data)) {
      throw new Error(`办理链接接口失败：${payload.message || "无商品数据"}`);
    }

    const links = new Map<number, Haoka172OrderLink>();
    for (const item of payload.data) {
      const link = toOrderLink(item);
      if (link) {
        links.set(link.productID, link);
      }
    }

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

  const snapshotLinks = await readOrderLinksFromSnapshot(userId);
  if (snapshotLinks?.size) {
    orderCatalogCache.set(userId, {
      expiresAt: Date.now() + getOrderLinkCacheTtlMs(),
      links: snapshotLinks
    });
    return snapshotLinks;
  }

  if (process.env.HAOKA172_DISABLE_LIVE_FETCH === "1") {
    return (await readOrderLinksFromSnapshot(userId, { allowStale: true })) ?? new Map<number, Haoka172OrderLink>();
  }

  try {
    return await fetchOrderCatalog(userId);
  } catch (error) {
    console.warn(error);
    return (await readOrderLinksFromSnapshot(userId, { allowStale: true })) ?? new Map<number, Haoka172OrderLink>();
  }
}
import { readFile } from "node:fs/promises";
import path from "node:path";
