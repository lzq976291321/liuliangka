import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getAllProducts } from "@/lib/haoka172";
import { getRecommendableProducts, isCityCompatible } from "@/lib/product-knowledge";
import { rankProducts } from "@/lib/recommendation";
import { getScenario, scenarioConfigs } from "@/lib/scenarios";

type ScenarioPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return scenarioConfigs.map((scenario) => ({ slug: scenario.slug }));
}

export async function generateMetadata({ params }: ScenarioPageProps): Promise<Metadata> {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) {
    return {};
  }

  return {
    title: `${scenario.title}：低月租大流量套餐对比`,
    description: `${scenario.description} 对比月租、流量、禁发地区、优惠期和办理条件。`,
    keywords: [scenario.keyword, "流量卡推荐", "长期流量卡", "低月租套餐"]
  };
}

export default async function ScenarioPage({ params }: ScenarioPageProps) {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) {
    notFound();
  }

  const products = getRecommendableProducts(await getAllProducts()).filter((product) => isCityCompatible(product, scenario.context.city));
  const ranked = rankProducts(products, scenario.context).slice(0, 5);

  return (
    <main className="page">
      <section className="page-heading">
        <div className="heading-block">
          <span className="eyebrow">{scenario.keyword}</span>
          <h1>{scenario.title}</h1>
          <p>{scenario.description}</p>
        </div>
        <aside className="side-note">
          <h2 className="section-title">适合人群</h2>
          <ul className="notice-list">
            {scenario.audience.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">推荐套餐</h2>
            <p className="section-note">推荐分由地区、场景、预算、流量、长期属性、选号和禁发区域综合计算。</p>
          </div>
          <Link className="button small" href="/assistant">
            重新匹配
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="product-grid">
          {ranked.slice(0, 3).map(({ product, result }) => (
            <ProductCard key={product.productID} product={product} reasons={result.reasons} score={result.score} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">套餐对比</h2>
            <p className="section-note">列表页只保留用户决策最关心的字段，详情页再展开规则和避坑说明。</p>
          </div>
        </div>
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>套餐</th>
                <th>月租/流量</th>
                <th>运营商</th>
                <th>长期属性</th>
                <th>限制</th>
                <th>推荐理由</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ product, result }) => (
                <tr key={product.productID}>
                  <td>
                    <strong>{product.productName}</strong>
                    <br />
                    <span className="tag green">推荐 {result.score}</span>
                  </td>
                  <td>
                    {product.monthlyRent}元/月
                    <br />
                    {product.dataGB}G
                  </td>
                  <td>{product.operator}</td>
                  <td>{product.priceTime}</td>
                  <td>
                    {product.age1}-{product.age2}岁
                    <br />
                    禁发 {product.disableArea.length} 项
                  </td>
                  <td>{result.reasons.join(" / ") || "适合作为备选"}</td>
                  <td>
                    <Link className="button small" href={`/card/${product.productID}`}>
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-panel detail-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">{scenario.shortTitle}办理前注意</h2>
              <p className="section-note">这些内容适合扩展成知乎回答、小红书笔记和页面 FAQ。</p>
            </div>
            <CheckCircle2 size={30} />
          </div>
          <ul className="notice-list">
            <li>如果常住地在禁发区域或边界地区，先人工确认再提交办理。</li>
            <li>主力号码优先看长期属性，副卡流量可以优先看月租和通用流量。</li>
            <li>支持选号不等于一定能选到靓号，选号接口返回为空时应回退普通下单。</li>
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">常见问题</h2>
          </div>
        </div>
        <div className="scenario-grid">
          {scenario.faq.map((item) => (
            <article className="scenario-tile" key={item.question}>
              <h3 className="scenario-title">{item.question}</h3>
              <p className="scenario-meta">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
