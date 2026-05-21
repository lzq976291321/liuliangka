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
const DEFAULT_ORDER_USER_ID = "5879e81e899912ce";
const orderCatalogCache = new Map<string, { expiresAt: number; links: Map<number, Haoka172OrderLink> }>();
const orderCatalogInFlight = new Map<string, Promise<Map<number, Haoka172OrderLink>>>();

function getOrderLinkCacheTtlMs() {
  return Number(process.env.HAOKA172_ORDER_LINK_CACHE_TTL_SECONDS ?? 600) * 1000;
}

function getOrderLinkMaxRetries() {
  return Number(process.env.HAOKA172_ORDER_LINK_MAX_RETRIES ?? 4);
}

export function getHaoka172OrderUserId() {
  return process.env.HAOKA172_ORDER_USER_ID || process.env.HAOKA172_AGENT_SN || DEFAULT_ORDER_USER_ID;
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
    productName: item.name || `172商品 ${productID}`,
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
      throw lastError instanceof Error ? lastError : new Error("172 前台商品链接接口连接失败");
    }

    if (!response.ok) {
      throw new Error(`172 前台商品链接接口失败：HTTP ${response.status}`);
    }

    const payload = (await response.json()) as ProductEnCatalogResponse;
    if (!Array.isArray(payload.data)) {
      throw new Error(`172 前台商品链接接口失败：${payload.message || "无商品数据"}`);
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

  try {
    const links = await fetchOrderCatalog(userId);
    return links.get(productID);
  } catch (error) {
    console.warn(error);
    return undefined;
  }
}

export async function getHaoka172OrderLinks() {
  const userId = getHaoka172OrderUserId();

  if (!userId) {
    return new Map<number, Haoka172OrderLink>();
  }

  try {
    return await fetchOrderCatalog(userId);
  } catch (error) {
    console.warn(error);
    return new Map<number, Haoka172OrderLink>();
  }
}
