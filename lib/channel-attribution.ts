import { useEffect, useState } from "react";
import projectChannelConfigs from "@/config/channel-config.json";
import { getBrowserVisitorId } from "@/lib/visitor-id";

export const channelQueryKeys = ["agent_id", "channel", "invite"] as const;

export type ChannelQueryKey = (typeof channelQueryKeys)[number];

export type ChannelAttribution = {
  key: ChannelQueryKey;
  code: string;
  capturedAt: string;
  landingPath?: string;
  landingSearch?: string;
};

export type ChannelConfig = {
  name: string;
  orderUserId?: string;
  orderParams?: Record<string, string>;
};

const channelStorageKey = "liuliangka_channel_attribution";
const channelVisitStorageKey = "liuliangka_channel_visit_events";

// 低配版渠道映射：左边是站内链接里的渠道码，右边是 172 办理页需要的真实推广参数。
const staticChannelConfigs: Record<string, ChannelConfig> = {
  // zhangsan: { name: "张三", orderUserId: "172给张三的userid" }
};

function normalizeChannelCode(value?: string | null) {
  const code = value?.trim();
  if (!code || code.length > 64 || !/^[A-Za-z0-9_-]+$/.test(code)) {
    return undefined;
  }

  return code;
}

function normalizeOrderParamName(value: string) {
  const name = value.trim();
  if (!name || name.length > 64 || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    return undefined;
  }

  return name;
}

function normalizeOrderParamValue(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOrderParams(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const params = Object.entries(value as Record<string, unknown>).flatMap(([rawKey, rawValue]) => {
    const key = normalizeOrderParamName(rawKey);
    const paramValue = normalizeOrderParamValue(rawValue);
    return key && paramValue ? ([[key, paramValue]] as const) : [];
  });

  return params.length ? Object.fromEntries(params) : undefined;
}

function normalizeChannelConfig(value: unknown): ChannelConfig | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "未命名渠道";
  const orderUserId = normalizeOrderParamValue(record.orderUserId ?? record.userId ?? record.promoParam);
  const orderParams = normalizeOrderParams(record.orderParams);

  if (!orderUserId && !orderParams) {
    return undefined;
  }

  return {
    name,
    ...(orderUserId ? { orderUserId } : {}),
    ...(orderParams ? { orderParams } : {})
  };
}

const configuredChannelConfigs = Object.entries(projectChannelConfigs as Record<string, unknown>).reduce<Record<string, ChannelConfig>>(
  (configs, [rawCode, rawValue]) => {
    const code = normalizeChannelCode(rawCode);
    const config = normalizeChannelConfig(rawValue);

    if (code && config) {
      configs[code] = config;
    }

    return configs;
  },
  {}
);

export function getChannelConfigs() {
  return {
    ...staticChannelConfigs,
    ...configuredChannelConfigs
  };
}

export function getChannelConfig(code?: string) {
  const normalizedCode = normalizeChannelCode(code);
  return normalizedCode ? getChannelConfigs()[normalizedCode] : undefined;
}

function readChannelAttributionFromSearch(search: string) {
  const params = new URLSearchParams(search);

  for (const key of channelQueryKeys) {
    const code = normalizeChannelCode(params.get(key));
    if (code) {
      return {
        key,
        code,
        capturedAt: new Date().toISOString()
      };
    }
  }

  return undefined;
}

function readStoredChannelAttribution() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const stored = window.localStorage.getItem(channelStorageKey);
    if (!stored) {
      return undefined;
    }

    const parsed = JSON.parse(stored) as Partial<ChannelAttribution>;
    const key = channelQueryKeys.find((item) => item === parsed.key);
    const code = normalizeChannelCode(parsed.code);

    if (!key || !code || !parsed.capturedAt) {
      return undefined;
    }

    return {
      key,
      code,
      capturedAt: parsed.capturedAt,
      landingPath: parsed.landingPath,
      landingSearch: parsed.landingSearch
    };
  } catch {
    return undefined;
  }
}

function writeStoredChannelAttribution(attribution: ChannelAttribution) {
  try {
    window.localStorage.setItem(channelStorageKey, JSON.stringify(attribution));
  } catch {
    // localStorage 不可用时，只影响跨页保持归因，不影响当前页面办理。
  }
}

function captureChannelAttribution() {
  if (typeof window === "undefined") {
    return { attribution: undefined, capturedFromUrl: false };
  }

  const fromSearch = readChannelAttributionFromSearch(window.location.search);
  if (fromSearch) {
    const attribution: ChannelAttribution = {
      ...fromSearch,
      landingPath: window.location.pathname,
      landingSearch: window.location.search
    };

    writeStoredChannelAttribution(attribution);
    return { attribution, capturedFromUrl: true };
  }

  return {
    attribution: readStoredChannelAttribution(),
    capturedFromUrl: false
  };
}

function getUtmTrackFields() {
  const query = new URLSearchParams(window.location.search);

  return {
    utmSource: query.get("utm_source") || undefined,
    utmMedium: query.get("utm_medium") || undefined,
    utmCampaign: query.get("utm_campaign") || undefined,
    utmContent: query.get("utm_content") || undefined
  };
}

export function getChannelTrackFields(attribution?: ChannelAttribution) {
  if (!attribution) {
    return {};
  }

  const config = getChannelConfig(attribution.code);

  return {
    channel: attribution.code,
    channelKey: attribution.key,
    channelName: config?.name,
    channelMatched: Boolean(config)
  };
}

function trackChannelVisit(attribution: ChannelAttribution) {
  try {
    const eventKey = `${attribution.key}:${attribution.code}:${window.location.pathname}:${window.location.search}`;
    const trackedEvents = JSON.parse(window.sessionStorage.getItem(channelVisitStorageKey) || "[]") as string[];
    if (trackedEvents.includes(eventKey)) {
      return;
    }

    window.sessionStorage.setItem(channelVisitStorageKey, JSON.stringify([...trackedEvents.slice(-20), eventKey]));

    const payload = JSON.stringify({
      event: "channel_visit",
      userId: getBrowserVisitorId(),
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      ...getUtmTrackFields(),
      ...getChannelTrackFields(attribution)
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      return;
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => undefined);
  } catch {
    // 访问记录失败不能阻断用户继续筛选和办理。
  }
}

export function useChannelAttribution() {
  const [attribution, setAttribution] = useState<ChannelAttribution | undefined>();

  useEffect(() => {
    const current = captureChannelAttribution();
    setAttribution(current.attribution);

    if (current.attribution && current.capturedFromUrl) {
      trackChannelVisit(current.attribution);
    }
  }, []);

  return attribution;
}

export function buildAttributedOrderUrl(orderUrl: string, attribution?: ChannelAttribution) {
  const config = getChannelConfig(attribution?.code);
  if (!config) {
    return orderUrl;
  }

  try {
    const baseUrl = typeof window === "undefined" ? "https://liuliangka.netlify.app" : window.location.origin;
    const url = new URL(orderUrl, baseUrl);

    if (config.orderUserId) {
      url.searchParams.set("userid", config.orderUserId);
    }

    for (const [key, value] of Object.entries(config.orderParams ?? {})) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  } catch {
    return orderUrl;
  }
}

export function buildChannelInternalHref(href: string, attribution?: ChannelAttribution) {
  if (!attribution) {
    return href;
  }

  try {
    const url = new URL(href, "https://liuliangka.local");
    url.searchParams.set(attribution.key, attribution.code);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
