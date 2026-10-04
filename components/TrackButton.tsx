"use client";

import { ExternalLink } from "lucide-react";
import type { MouseEvent } from "react";
import { buildAttributedOrderUrl, useChannelAttribution } from "@/lib/channel-attribution";
import { trackEvent } from "@/lib/track-event";

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
    trackEvent("apply_click", { productId, productName, source }, channelAttribution);

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
