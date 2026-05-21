import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { ContentFactoryClient } from "@/app/content/ContentFactoryClient";
import { generateContentPackage } from "@/lib/content-factory";
import { getAllProducts } from "@/lib/haoka172";
import { getRecommendableProducts, isCityCompatible } from "@/lib/product-knowledge";
import { rankProducts } from "@/lib/recommendation";
import { scenarioConfigs } from "@/lib/scenarios";

export const metadata: Metadata = {
  title: "内容工厂",
  description: "基于流量卡套餐和场景词自动生成知乎、小红书、SEO、短视频和海报素材。"
};

export default async function ContentPage() {
  const products = getRecommendableProducts(await getAllProducts());
  const packages = scenarioConfigs.map((scenario) => {
    const scenarioProducts = products.filter((product) => isCityCompatible(product, scenario.context.city));
    return generateContentPackage(scenario, rankProducts(scenarioProducts, scenario.context));
  });

  return (
    <main className="page">
      <section className="content-hero">
        <div>
          <span className="eyebrow">
            <Sparkles size={16} />
            内容生产闭环
          </span>
          <h1 className="hero-title">选一个关键词，生成一套可发布素材。</h1>
        </div>
        <p className="hero-copy">
          固定模板读取套餐数据，自动生成知乎回答、小红书笔记、短视频口播、FAQ、SEO 文案和渠道 UTM 链接。先人工发布验证点击，再接 AI 改写和批量分发。
        </p>
      </section>
      <ContentFactoryClient packages={packages} />
    </main>
  );
}
