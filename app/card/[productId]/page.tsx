import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, Clock, MapPinned, ShieldCheck } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { RemoteImage } from "@/components/RemoteImage";
import { TrackButton } from "@/components/TrackButton";
import { getAllProducts, getProductById } from "@/lib/haoka172";
import { enrichProduct, getRecommendableProducts } from "@/lib/product-knowledge";
import { rankProducts, scoreProduct } from "@/lib/recommendation";

type ProductPageProps = {
  params: Promise<{ productId: string }>;
};

export async function generateStaticParams() {
  const products = getRecommendableProducts(await getAllProducts());
  return products.map((product) => ({ productId: String(product.productID) }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { productId } = await params;
  const rawProduct = await getProductById(productId);
  const product = rawProduct ? enrichProduct(rawProduct) : undefined;
  if (!product) {
    return {};
  }

  return {
    title: `${product.productName}套餐详情`,
    description: `${product.productName}：${product.monthlyRent}元/月，${product.dataGB}G，总结月租、流量、办理限制、禁发区域和避坑说明。`,
    keywords: [product.productName, `${product.operator}流量卡`, "流量卡套餐详情"]
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { productId } = await params;
  const rawProduct = await getProductById(productId);
  const product = rawProduct ? enrichProduct(rawProduct) : undefined;
  if (!product) {
    notFound();
  }

  const products = getRecommendableProducts(await getAllProducts());
  const scored = scoreProduct(product, { budget: 39, dataNeedGB: 180 });
  const related = rankProducts(
    products.filter((item) => item.productID !== product.productID),
    { scene: product.scenes[0], city: product.cities[0], budget: product.monthlyRent }
  ).slice(0, 3);

  return (
    <main className="page">
      <div className="detail-layout">
        <section className="detail-main">
          <article className="detail-hero">
            <RemoteImage src={product.mainPic} alt={product.productName} />
            <div className="detail-hero-body">
              <div className="product-topline">
                <span className="tag green">{product.operator}</span>
                <span className="tag amber">{product.priceTime}</span>
                <span className="tag">推荐 {scored.score}</span>
              </div>
              <h1>{product.productName}</h1>
              <p className="hero-copy">{product.taocan}</p>
            </div>
          </article>

          <section className="detail-panel">
            <div className="section-header">
              <div>
                <h2 className="section-title">套餐详情</h2>
                <p className="section-note">从用户决策角度拆解月租、流量、年龄、选号和办理地区。</p>
              </div>
              <BadgeCheck size={30} />
            </div>
            <div className="spec-row">
              <div className="spec">
                <strong>{product.monthlyRent}元</strong>
                <span>月租</span>
              </div>
              <div className="spec">
                <strong>{product.dataGB}G</strong>
                <span>总流量</span>
              </div>
              <div className="spec">
                <strong>{product.callMinutes}</strong>
                <span>通话分钟</span>
              </div>
            </div>
          </section>

          <section className="detail-panel">
            <div className="section-header">
              <div>
                <h2 className="section-title">办理区域</h2>
                <p className="section-note">SKU 对应 172 商品的办理区域字段，后续可直接由接口同步。</p>
              </div>
              <MapPinned size={30} />
            </div>
            <div className="scenario-grid">
              {product.skus.map((sku) => (
                <article className="scenario-tile" key={sku.id}>
                  <h3 className="scenario-title">{sku.name}</h3>
                  <p className="scenario-meta">{sku.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-panel">
            <div className="section-header">
              <div>
                <h2 className="section-title">结算和规则</h2>
                <p className="section-note">这些字段会影响你后台选品，不建议全部暴露成强营销文案。</p>
              </div>
              <Clock size={30} />
            </div>
            <ul className="notice-list">
              <li>{product.rule}</li>
              <li>返佣类型：{product.backMoneyType}，样例佣金：{product.commission || "待补充"} 元。</li>
              <li>年龄范围：{product.age1}-{product.age2} 岁。</li>
            </ul>
          </section>

          <section className="detail-panel">
            <div className="section-header">
              <div>
                <h2 className="section-title">避坑说明</h2>
                <p className="section-note">转化页内保留风险提醒，比单独做黑榜更稳。</p>
              </div>
              <AlertTriangle size={30} />
            </div>
            <ul className="notice-list">
              {product.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
              <li>禁发区域：{product.disableArea.join("、") || "暂无明确禁发区域"}。</li>
            </ul>
          </section>
        </section>

        <aside className="sticky-aside">
          <section className="detail-panel" id="apply-panel">
            <h2 className="section-title">办理入口</h2>
            <dl className="kv-list">
              <div className="kv">
                <dt>推荐分</dt>
                <dd>{scored.score}</dd>
              </div>
              <div className="kv">
                <dt>选号</dt>
                <dd>{product.numberSel === 0 ? "不支持" : "支持"}</dd>
              </div>
              <div className="kv">
                <dt>归属地</dt>
                <dd>{product.area}</dd>
              </div>
              <div className="kv">
                <dt>优惠期</dt>
                <dd>{product.priceTime}</dd>
              </div>
            </dl>
            <div style={{ marginTop: 16 }}>
              <TrackButton productId={product.productID} productName={product.productName} href={`/order/${product.productID}`} source="product_detail" />
            </div>
          </section>

          <section className="detail-panel">
            <div className="section-header">
              <h2 className="section-title">推荐理由</h2>
              <ShieldCheck size={26} />
            </div>
            <ul className="notice-list">
              {scored.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">相近套餐</h2>
            <p className="section-note">保留对比入口，避免用户从详情页直接流失。</p>
          </div>
        </div>
        <div className="product-grid">
          {related.map(({ product: item, result }) => (
            <ProductCard key={item.productID} product={item} reasons={result.reasons} score={result.score} />
          ))}
        </div>
      </section>
    </main>
  );
}
