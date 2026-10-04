"use client";

import { useEffect, useState } from "react";
import "./catalog-enhancements.css";

type OrderFrameProps = {
  src: string;
  title: string;
};

type FrameStatus = "loading" | "unconfirmed" | "timed-out";
const loadTimeoutMs = 10000;

function LoadingFrame({ src, title }: OrderFrameProps) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<FrameStatus>("loading");

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("timed-out"), loadTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [attempt, status]);

  function retry() {
    setStatus("loading");
    setAttempt((current) => current + 1);
  }

  return (
    <section className="order-iframe-shell recoverable-order-frame" aria-busy={status === "loading"}>
      <div className="order-frame-recovery">
        <p role="status">{status === "loading" ? "正在打开办理页…" : status === "timed-out" ? "办理页暂未显示，可重试或在新窗口继续。" : "页面空白或无法填写？可重试或在新窗口办理。"}</p>
        <div><button type="button" onClick={retry}>重新加载</button><a href={src} target="_blank" rel="noopener noreferrer">新窗口办理</a></div>
      </div>
      <div className="order-frame-content">
        {status === "loading" ? (
          <div className="order-frame-skeleton" aria-hidden="true">
            <div className="order-skeleton-top"><span /><strong>正在加载办理页</strong></div>
            <div className="order-skeleton-form"><i /><i /><i /><i /></div>
            <div className="order-skeleton-button" />
          </div>
        ) : null}
        <iframe
          allow="clipboard-write; payment; fullscreen"
          className={`order-iframe${status !== "loading" ? " loaded" : ""}`}
          key={attempt}
          // Cross-origin load also fires for error pages; it only releases the loading overlay.
          onLoad={() => setStatus("unconfirmed")}
          onError={() => setStatus("timed-out")}
          referrerPolicy="no-referrer-when-downgrade"
          src={src}
          title={title}
        />
      </div>
    </section>
  );
}

export function OrderFrame({ src, title }: OrderFrameProps) {
  let validSrc = false;
  try { validSrc = ["https:", "http:"].includes(new URL(src).protocol); } catch { /* Missing or invalid URLs have no actionable destination. */ }
  if (!validSrc) return <section className="order-frame-unavailable" role="status">办理入口暂不可用，请关闭后选择其他套餐。</section>;
  // Changing products resets the timer and frame without carrying over a previous load event.
  return <LoadingFrame key={src} src={src} title={title} />;
}
