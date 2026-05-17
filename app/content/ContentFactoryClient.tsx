"use client";

import type { Route } from "next";
import Link from "next/link";
import { Check, Clipboard, FileText, Image as ImageIcon, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { GeneratedContentPackage } from "@/lib/content-factory";

type ContentFactoryClientProps = {
  packages: GeneratedContentPackage[];
};

type TextBlock = {
  id: string;
  title: string;
  note: string;
  content: string;
};

export function ContentFactoryClient({ packages }: ContentFactoryClientProps) {
  const [activeSlug, setActiveSlug] = useState(packages[0]?.slug ?? "");
  const [copiedId, setCopiedId] = useState("");
  const active = packages.find((item) => item.slug === activeSlug) ?? packages[0];

  const blocks = useMemo<TextBlock[]>(
    () =>
      active
        ? [
            {
              id: "seo",
              title: "SEO 页面文案",
              note: "用于页面标题、描述和首屏说明。",
              content: `标题：${active.seoTitle}\n\n描述：${active.seoDescription}\n\n首屏：${active.pageIntro}`
            },
            {
              id: "zhihu",
              title: "知乎回答",
              note: "长回答结构：先避坑，再对比，再给入口。",
              content: `${active.zhihuTitle}\n\n${active.zhihuBody}`
            },
            {
              id: "xhs",
              title: "小红书笔记",
              note: "适合图文首发，标题和正文分开发。",
              content: `${active.xhsTitle}\n\n${active.xhsBody}`
            },
            {
              id: "video",
              title: "短视频口播",
              note: "30 秒以内，用来做口播或图文视频。",
              content: active.videoScript
            },
            {
              id: "faq",
              title: "FAQ",
              note: "可以补进落地页，也可以拆成问答内容。",
              content: active.faqText
            }
          ]
        : [],
    [active]
  );

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  if (!active) {
    return null;
  }

  return (
    <div className="content-workbench">
      <aside className="content-sidebar">
        <div className="content-sidebar-head">
          <span className="eyebrow">
            <FileText size={16} />
            选择关键词
          </span>
        </div>
        <div className="content-tabs" role="tablist" aria-label="内容包">
          {packages.map((item) => (
            <button className={item.slug === active.slug ? "active" : ""} key={item.slug} onClick={() => setActiveSlug(item.slug)} type="button">
              <strong>{item.keyword}</strong>
              <span>{item.primaryProductName}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="content-main">
        <div className="content-summary">
          <div>
            <span className="tag green">{active.keyword}</span>
            <h2 className="section-title">{active.title}内容包</h2>
            <p className="section-note">{active.pageIntro}</p>
          </div>
          <Link className="button primary" href={active.posterPath as Route}>
            <ImageIcon size={17} />
            打开海报
          </Link>
        </div>

        <div className="content-link-grid">
          {active.links.map((link) => (
            <div className="content-link-card" key={link.source}>
              <div>
                <span className="tag amber">{link.label}</span>
                <strong>{link.play}</strong>
              </div>
              <button className="button small" onClick={() => copyText(`link-${link.source}`, link.url)} type="button">
                {copiedId === `link-${link.source}` ? <Check size={14} /> : <Link2 size={14} />}
                {copiedId === `link-${link.source}` ? "已复制" : "复制链接"}
              </button>
            </div>
          ))}
        </div>

        <div className="content-product-strip">
          {active.products.map((product) => (
            <div className="content-product" key={product.id}>
              <span>推荐 {product.score}</span>
              <strong>{product.name}</strong>
              <p>
                {product.monthlyRent}元 / {product.dataGB}G / {product.operator} / {product.priceTime}
              </p>
            </div>
          ))}
        </div>

        <div className="content-blocks">
          {blocks.map((block) => (
            <article className="content-block" key={block.id}>
              <div className="section-header">
                <div>
                  <h3 className="scenario-title">{block.title}</h3>
                  <p className="section-note">{block.note}</p>
                </div>
                <button className="button small" onClick={() => copyText(block.id, block.content)} type="button">
                  {copiedId === block.id ? <Check size={14} /> : <Clipboard size={14} />}
                  {copiedId === block.id ? "已复制" : "复制"}
                </button>
              </div>
              <textarea readOnly value={block.content} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
