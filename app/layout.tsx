import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "本地流量卡推荐",
    template: "%s - 本地流量卡推荐"
  },
  description: "按城市、预算、场景筛选低月租、大流量、长期套餐，帮助用户更快选到适合自己的手机卡。",
  openGraph: {
    title: "本地流量卡推荐",
    description: "按月租、通用流量、归属地和运营商筛选适合自己的手机卡。",
    type: "website",
    url: siteUrl
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://haokaapi.lot-ml.com" />
      </head>
      <body>
        <div className="site-shell">
          <header className="topbar">
            <div className="topbar-inner">
              <Link className="brand" href="/">
                <span className="brand-mark">卡</span>
                <span>本地流量卡推荐</span>
              </Link>
            </div>
          </header>
          {children}
          <footer className="footer">
            <div className="footer-inner">
              <span>套餐信息会随运营商政策调整，办理前请以办理页展示为准。</span>
              <span>重点核对归属地、年龄限制、优惠期、首充和注销规则。</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
