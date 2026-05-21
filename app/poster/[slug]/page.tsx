import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, RadioTower } from "lucide-react";
import { PosterActions } from "@/app/poster/[slug]/PosterActions";
import { RemoteImage } from "@/components/RemoteImage";
import { generateContentPackage } from "@/lib/content-factory";
import { getAllProducts } from "@/lib/haoka172";
import { getRecommendableProducts, isCityCompatible } from "@/lib/product-knowledge";
import { rankProducts } from "@/lib/recommendation";
import { getScenario, scenarioConfigs } from "@/lib/scenarios";

type PosterPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return scenarioConfigs.map((scenario) => ({ slug: scenario.slug }));
}

export async function generateMetadata({ params }: PosterPageProps): Promise<Metadata> {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) {
    return {};
  }

  return {
    title: `${scenario.title}海报`,
    description: `${scenario.title}推广海报，可截图用于图文内容分发。`
  };
}

export default async function PosterPage({ params }: PosterPageProps) {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) {
    notFound();
  }

  const products = getRecommendableProducts(await getAllProducts()).filter((product) => isCityCompatible(product, scenario.context.city));
  const ranked = rankProducts(products, scenario.context);
  const content = generateContentPackage(scenario, ranked);
  const primary = ranked[0]?.product;

  return (
    <main className="page poster-page">
      <div className="section-header">
        <div>
          <span className="eyebrow">
            <RadioTower size={16} />
            海报模板
          </span>
          <h1 className="section-title" style={{ marginTop: 12 }}>
            {scenario.title}海报
          </h1>
        </div>
        <Link className="button" href="/content">
          <ArrowLeft size={17} />
          返回内容工厂
        </Link>
      </div>

      <section className="poster-layout">
        <article className="poster-canvas" aria-label={`${scenario.title}推广海报`}>
          {primary ? (
            <div className="poster-photo">
              <RemoteImage src={primary.mainPic} alt={primary.productName} />
            </div>
          ) : null}
          <div className="poster-noise" />
          <div className="poster-content">
            <div className="poster-top">
              <span>{scenario.keyword}</span>
              <b>本地流量卡推荐</b>
            </div>
            <h2>{content.posterHeadline}</h2>
            <p>{content.posterSubline}</p>
            <div className="poster-products">
              {content.products.map((product, index) => (
                <div className="poster-product-row" key={product.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{product.name}</strong>
                    <small>
                      {product.monthlyRent}元 / {product.dataGB}G / {product.operator}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="poster-bottom">
              <div className="poster-qr">
                <BadgeCheck size={30} />
                <span>扫码/搜索</span>
              </div>
              <div>
                <strong>办理前先看对比</strong>
                <small>复制渠道链接后发布，海报不展示明文长链接</small>
              </div>
            </div>
          </div>
        </article>

        <aside className="poster-side">
          <div className="ops-panel">
            <h2 className="section-title">使用方式</h2>
            <ul className="notice-list" style={{ marginTop: 14 }}>
              <li>直接截图海报区域，用在小红书封面、朋友圈或短视频尾页。</li>
              <li>海报文字来自套餐数据和内容模板，不直接让 AI 生成图片，减少错字和参数错误。</li>
              <li>发布时配合内容工厂里的 UTM 链接，后续能追踪渠道点击。</li>
            </ul>
          </div>
          <div className="ops-panel">
            <h2 className="section-title">渠道链接</h2>
            <p className="section-note">链接只通过按钮复制，不在页面和海报中展示明文长链接。</p>
            <PosterActions links={content.links} />
          </div>
        </aside>
      </section>
    </main>
  );
}
