"use client";

import { getChannelTrackFields, type ChannelAttribution } from "@/lib/channel-attribution";
import { getBrowserVisitorId } from "@/lib/visitor-id";

export function trackEvent(event: "apply_click" | "comparison_open" | "catalog_zero_results", fields: Record<string, unknown>, attribution?: ChannelAttribution) {
  const query = new URLSearchParams(window.location.search);
  const payload = JSON.stringify({
    ...fields, event, userId: getBrowserVisitorId(), path: window.location.pathname,
    utmSource: query.get("utm_source") || undefined, utmMedium: query.get("utm_medium") || undefined,
    utmCampaign: query.get("utm_campaign") || undefined, utmContent: query.get("utm_content") || undefined,
    ...getChannelTrackFields(attribution)
  });
  if (navigator.sendBeacon?.("/api/track", new Blob([payload], { type: "application/json" }))) return;
  void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
}
