"use client";

import { ExternalLink } from "lucide-react";
import type { MouseEvent } from "react";
import { getBrowserVisitorId } from "@/lib/visitor-id";

type TrackButtonProps = {
  productId: number;
  productName: string;
  href: string;
  source: string;
  label?: string;
  recommId?: string;
  engine?: string;
};

export function TrackButton({ productId, productName, href, source, label = "获取办理入口", recommId, engine }: TrackButtonProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const query = new URLSearchParams(window.location.search);
    const payload = JSON.stringify({
      event: "apply_click",
      productId,
      productName,
      source,
      recommId,
      engine,
      userId: getBrowserVisitorId(),
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      utmSource: query.get("utm_source") || undefined,
      utmMedium: query.get("utm_medium") || undefined,
      utmCampaign: query.get("utm_campaign") || undefined,
      utmContent: query.get("utm_content") || undefined
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

    if (href.startsWith("#")) {
      event.preventDefault();
      window.location.hash = href.slice(1);
    }
  }

  return (
    <a className="button green" href={href} onClick={handleClick}>
      <ExternalLink size={17} />
      {label}
    </a>
  );
}
