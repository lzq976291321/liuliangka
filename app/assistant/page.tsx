import type { Metadata } from "next";
import { AssistantClient } from "@/app/assistant/AssistantClient";
import { getAllProducts } from "@/lib/haoka172";
import { getRecommendableProducts } from "@/lib/product-knowledge";
import { recommendProducts } from "@/lib/recommendation-engine";

export const metadata: Metadata = {
  title: "AI 选号助手",
  description: "按城市、预算、流量需求、运营商偏好和使用场景推荐合适的流量卡。"
};

export default async function AssistantPage() {
  const products = getRecommendableProducts(await getAllProducts());
  const initialRecommendation = await recommendProducts({
    products,
    intent: { city: "shenzhen", scene: "cheap", budget: 39, dataNeedGB: 180, operator: "不限", age: 24 },
    limit: 4,
    scenario: "assistant"
  });

  return (
    <main className="page">
      <section className="page-heading">
        <div className="heading-block">
          <span className="eyebrow">AI 选号助手</span>
          <h1>输入需求，直接给出推荐顺序。</h1>
          <p>先由商品知识库过滤不可推荐商品，再交给当前推荐引擎排序；未配置第三方时自动使用本地兜底。</p>
        </div>
        <aside className="side-note">
          <h2 className="section-title">推荐逻辑</h2>
          <ul className="notice-list">
            <li>地区可办、预算内、大流量、长期属性优先。</li>
            <li>年龄不匹配会明显降权。</li>
            <li>禁发区域多、优惠期短会降低推荐分。</li>
          </ul>
        </aside>
      </section>
      <AssistantClient initialRecommendations={initialRecommendation.recommendations} />
    </main>
  );
}
