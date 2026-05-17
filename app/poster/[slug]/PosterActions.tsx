"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

type PosterActionsProps = {
  links: Array<{
    label: string;
    source: string;
    play: string;
    url: string;
  }>;
};

export function PosterActions({ links }: PosterActionsProps) {
  const [copiedSource, setCopiedSource] = useState("");

  async function copyLink(source: string, url: string) {
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopiedSource(source);
    window.setTimeout(() => setCopiedSource(""), 1400);
  }

  return (
    <div className="poster-action-grid">
      {links.map((link) => (
        <button className="poster-copy-button" key={link.source} onClick={() => copyLink(link.source, link.url)} type="button">
          <span>
            <strong>{link.label}</strong>
            <small>{link.play}</small>
          </span>
          {copiedSource === link.source ? <Check size={17} /> : <Link2 size={17} />}
          <b>{copiedSource === link.source ? "已复制" : "复制"}</b>
        </button>
      ))}
    </div>
  );
}
