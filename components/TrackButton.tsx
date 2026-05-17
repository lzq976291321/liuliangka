"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

type TrackButtonProps = {
  productId: number;
  productName: string;
  href: string;
  source: string;
  label?: string;
};

export function TrackButton({ productId, productName, href, source, label = "获取办理入口" }: TrackButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const query = new URLSearchParams(window.location.search);
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "apply_click",
        productId,
        productName,
        source,
        path: window.location.pathname,
        referrer: document.referrer || undefined,
        utmSource: query.get("utm_source") || undefined,
        utmMedium: query.get("utm_medium") || undefined,
        utmCampaign: query.get("utm_campaign") || undefined,
        utmContent: query.get("utm_content") || undefined
      })
    }).catch(() => undefined);
    setPending(false);

    if (href.startsWith("#")) {
      window.location.hash = href.slice(1);
    } else {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <button className="button green" disabled={pending} onClick={handleClick} type="button">
      <ExternalLink size={17} />
      {pending ? "记录中" : label}
    </button>
  );
}
