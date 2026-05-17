import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://local-card.example"),
  title: {
    default: "本地流量卡推荐工具",
    template: "%s - 本地流量卡推荐工具"
  },
  description: "按城市、预算、场景筛选低月租、大流量、长期套餐，帮助用户更快选到适合自己的手机卡。",
  openGraph: {
    title: "本地流量卡推荐工具",
    description: "地区场景化流量卡推荐、套餐对比和办理点击追踪。",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="site-shell">
          <header className="topbar">
            <div className="topbar-inner">
              <Link className="brand" href="/">
                <span className="brand-mark">卡</span>
                <span>本地流量卡推荐</span>
              </Link>
              <nav className="nav" aria-label="主导航">
                <Link href="/liuliangka/shenzhen">深圳</Link>
                <Link href="/liuliangka/guangzhou">广州</Link>
                <Link href="/liuliangka/student">学生党</Link>
                <Link href="/liuliangka/cheap">低月租</Link>
                <Link href="/assistant">选号助手</Link>
              </nav>
            </div>
          </header>
          {children}
          <footer className="footer">
            <div className="footer-inner">
              <span>按 172 商品字段生成推荐页，后续可替换为真实库存。</span>
              <span>建议办理前核对禁发地区、年龄限制、优惠期和注销规则。</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
