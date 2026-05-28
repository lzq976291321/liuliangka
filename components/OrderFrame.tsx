"use client";

import { useEffect, useMemo, useState } from "react";

type OrderFrameProps = {
  src: string;
  title: string;
};

const maxAttempts = 4;

function withRetryParam(src: string, attempt: number) {
  if (attempt === 0) {
    return src;
  }

  try {
    const url = new URL(src);
    url.searchParams.set("_frameRetry", String(attempt));
    return url.toString();
  } catch {
    return src;
  }
}

export function OrderFrame({ src, title }: OrderFrameProps) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const frameSrc = useMemo(() => withRetryParam(src, attempt), [attempt, src]);

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    if (loaded || attempt >= maxAttempts - 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAttempt((current) => current + 1);
    }, 2800 + attempt * 1200);

    return () => window.clearTimeout(timer);
  }, [attempt, loaded]);

  return (
    <section className="order-iframe-shell">
      {!loaded ? (
        <div className="order-frame-skeleton" aria-live="polite">
          <div className="order-skeleton-top">
            <span />
            <strong>正在加载办理页</strong>
          </div>
          <div className="order-skeleton-form">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="order-skeleton-button" />
        </div>
      ) : null}
      <iframe
        allow="clipboard-write; payment; fullscreen"
        className={`order-iframe${loaded ? " loaded" : ""}`}
        key={frameSrc}
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer-when-downgrade"
        src={frameSrc}
        title={title}
      />
    </section>
  );
}
