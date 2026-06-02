"use client";

import { ExternalLink } from "lucide-react";
import type { MouseEvent } from "react";
import { buildAttributedOrderUrl, getChannelTrackFields, useChannelAttribution } from "@/lib/channel-attribution";
import { getBrowserVisitorId } from "@/lib/visitor-id";

type TrackButtonProps = {
  productId: number;
  productName: string;
  href: string;
  source: string;
  label?: string;
};

export function TrackButton({ productId, productName, href, source, label = "获取办理入口" }: TrackButtonProps) {
  const channelAttribution = useChannelAttribution();
  const attributedHref = buildAttributedOrderUrl(href, channelAttribution);
  const isExternal = /^https?:\/\//.test(attributedHref);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const query = new URLSearchParams(window.location.search);
    const payload = JSON.stringify({
      event: "apply_click",
      productId,
      productName,
      source,
      userId: getBrowserVisitorId(),
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      utmSource: query.get("utm_source") || undefined,
      utmMedium: query.get("utm_medium") || undefined,
      utmCampaign: query.get("utm_campaign") || undefined,
      utmContent: query.get("utm_content") || undefined,
      ...getChannelTrackFields(channelAttribution)
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => undefined);
    }

    if (attributedHref.startsWith("#")) {
      event.preventDefault();
      window.location.hash = attributedHref.slice(1);
    }
  }

  return (
    <a className="button green" href={attributedHref} onClick={handleClick} rel={isExternal ? "noreferrer" : undefined} target={isExternal ? "_blank" : undefined}>
      <ExternalLink size={17} />
      {label}
    </a>
  );
}
