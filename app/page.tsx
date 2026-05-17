import { ArrowRight, Bot, MapPinned, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { RemoteImage } from "@/components/RemoteImage";
import { getAllProducts } from "@/lib/haoka172";
import { rankProducts } from "@/lib/recommendation";
import { scenarioConfigs } from "@/lib/scenarios";

export default async function HomePage() {
  const products = await getAllProducts();
  const ranked = rankProducts(products, { budget: 39, dataNeedGB: 180 });
  const topProducts = ranked.slice(0, 3);
  const cityScenarios = scenarioConfigs.filter((scenario) => ["shenzhen", "guangzhou", "dongguan"].includes(scenario.slug));
  const sceneScenarios = scenarioConfigs.filter((scenario) => !["shenzhen", "guangzhou", "dongguan"].includes(scenario.slug));

  return (
    <main className="page">
      <section className="hero-workbench">
        <div className="hero-main">
          <div className="hero-photo">
            <RemoteImage src="https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=1400&q=80" alt="手机流量卡办理场景" />
          </div>
          <div className="hero-grid" />
          <div className="hero-content">
            <div>
              <span className="eyebrow">
                <MapPinned size={16} />
                地区场景化选卡
              </span>
              <h1 className="hero-title">先帮用户选对卡，再做办理转化。</h1>
              <p className="hero-copy">
                按城市、预算、流量、年龄和使用场景筛选套餐，把 172 商品字段变成可搜索、可对比、可追踪的推荐页。
              </p>
              <div className="hero-actions">
                <Link className="button primary" href="/liuliangka/shenzhen">
                  深圳推荐
                  <ArrowRight size={17} />
                </Link>
                <Link className="button" href="/assistant">
                  <Bot size={17} />
                  选号助手
                </Link>
              </div>
            </div>
            <div className="product-topline">
              <span className="tag green">长期套餐</span>
              <span className="tag amber">低月租</span>
              <span className="tag">地区页</span>
              <span className="tag">点击追踪</span>
            </div>
          </div>
        </div>
        <aside className="insight-panel">
          <div className="insight-card">
            <div className="metric-line">
              <span className="metric-label">已载入套餐</span>
              <strong className="metric-value">{products.length}</strong>
            </div>
            <div className="metric-line">
              <span className="metric-label">推荐页模板</span>
              <strong className="metric-value">{scenarioConfigs.length}</strong>
            </div>
            <div className="metric-line">
              <span className="metric-label">优先测试预算</span>
              <strong className="metric-value">39元</strong>
            </div>
          </div>
          <div className="insight-card">
            <h2 className="section-title">第一版策略</h2>
            <ul className="notice-list">
              <li>每个地区/场景只推荐 3-5 张卡，减少用户决策成本。</li>
              <li>先追踪办理点击和来源关键词，再决定主推哪张卡。</li>
              <li>身份证和证件照相关流程先不自动化，避免合规风险。</li>
            </ul>
          </div>
        </aside>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">今日优先测试</h2>
            <p className="section-note">按低月租、大流量、长期属性、可办地区和佣金潜力计算，先拿这些卡做转化测试。</p>
          </div>
          <Link className="button small" href="/liuliangka/cheap">
            <SlidersHorizontal size={15} />
            看低月租
          </Link>
        </div>
        <div className="product-grid">
          {topProducts.map(({ product, result }) => (
            <ProductCard key={product.productID} product={product} reasons={result.reasons} score={result.score} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">地区入口</h2>
            <p className="section-note">从本地搜索词切入，城市页承接用户真实办理意图。</p>
          </div>
        </div>
        <div className="scenario-grid">
          {cityScenarios.map((scenario) => (
            <Link className="scenario-tile" href={`/liuliangka/${scenario.slug}`} key={scenario.slug}>
              <div>
                <span className="tag green">{scenario.keyword}</span>
                <h3 className="scenario-title">{scenario.title}</h3>
              </div>
              <p className="scenario-meta">{scenario.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">场景入口</h2>
            <p className="section-note">学生、低月租、长期、游戏、外卖跑腿这些词更适合知乎和小红书同步分发。</p>
          </div>
        </div>
        <div className="scenario-grid">
          {sceneScenarios.map((scenario) => (
            <Link className="scenario-tile" href={`/liuliangka/${scenario.slug}`} key={scenario.slug}>
              <div>
                <span className="tag amber">{scenario.keyword}</span>
                <h3 className="scenario-title">{scenario.title}</h3>
              </div>
              <p className="scenario-meta">{scenario.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-panel detail-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">办理前注意</h2>
              <p className="section-note">避坑内容放在转化页内，不单独做攻击型黑榜，降低投诉风险同时提升信任。</p>
            </div>
            <ShieldCheck size={30} />
          </div>
          <ul className="notice-list">
            <li>只看“总流量”不够，要拆分通用流量、定向流量和优惠期。</li>
            <li>优先核对禁发区域、年龄限制、首充金额、是否官方可查长期。</li>
            <li>主力卡建议选长期属性更强的套餐，备用卡可以选择短期高性价比套餐。</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
