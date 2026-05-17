import type { Metadata } from "next";
import { AssistantClient } from "@/app/assistant/AssistantClient";
import { getAllProducts } from "@/lib/haoka172";

export const metadata: Metadata = {
  title: "AI 选号助手",
  description: "按城市、预算、流量需求、运营商偏好和使用场景推荐合适的流量卡。"
};

export default async function AssistantPage() {
  const products = await getAllProducts();

  return (
    <main className="page">
      <section className="page-heading">
        <div className="heading-block">
          <span className="eyebrow">AI 选号助手</span>
          <h1>输入需求，直接给出推荐顺序。</h1>
          <p>第一版先用规则评分，等有真实点击和订单数据后，再把点击率、结算率和退单率加入模型。</p>
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
      <AssistantClient products={products} />
    </main>
  );
}
