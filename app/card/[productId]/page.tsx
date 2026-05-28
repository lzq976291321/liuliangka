import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, Clock, MapPinned, ShieldCheck } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { RemoteImage } from "@/components/RemoteImage";
import { TrackButton } from "@/components/TrackButton";
import { getAllProducts, getOrderLinks, getProductById } from "@/lib/catalog-source";
import { enrichProduct, getRecommendableProducts } from "@/lib/product-knowledge";
import { rankProducts, scoreProduct } from "@/lib/recommendation";

type ProductPageProps = {
  params: Promise<{ productId: string }>;
};

export const dynamic = "force-dynamic";

function toNumber(value?: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : undefined;
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
    description: `${product.productName}：${product.monthlyRent}元/月，整理通用流量、办理限制、禁发区域和注意事项。`,
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

  const [allProducts, orderLinks] = await Promise.all([getAllProducts(), getOrderLinks()]);
  const products = getRecommendableProducts(allProducts).filter((item) => {
    const link = orderLinks.get(item.productID);
    return Boolean(link?.shareUrl && link.pudId && link.userId);
  });
  const scored = scoreProduct(product, { budget: 39, dataNeedGB: 180 });
  const orderLink = orderLinks.get(product.productID);
  if (!orderLink?.shareUrl || !orderLink.pudId || !orderLink.userId) {
    notFound();
  }

  const monthlyRent = toNumber(orderLink.monthlyRent) ?? product.monthlyRent;
  const generalDataGB = toNumber(orderLink.generalDataGB) ?? product.generalDataGB ?? product.dataGB;
  const callMinutes = toNumber(orderLink.callMinutes) ?? product.callMinutes;
  const age1 = orderLink.age1 ?? product.age1;
  const age2 = orderLink.age2 ?? product.age2;
  const related = rankProducts(
    products.filter((item) => item.productID !== product.productID),
    { scene: product.scenes[0], city: product.cities[0], budget: monthlyRent }
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
                <span className="tag">{product.area}</span>
              </div>
              <h1>{product.productName}</h1>
              <p className="hero-copy">{product.taocan || "办理前请核对月租、通用流量、优惠期、首充和地区限制。"}</p>
            </div>
          </article>

          <section className="detail-panel">
            <div className="section-header">
              <div>
                <h2 className="section-title">套餐详情</h2>
                <p className="section-note">先看月租、通用流量、通话、年龄和办理地区，避免只看标题下单。</p>
              </div>
              <BadgeCheck size={30} />
            </div>
            <div className="spec-row">
              <div className="spec">
                <strong>{monthlyRent}元</strong>
                <span>月租</span>
              </div>
              <div className="spec">
                <strong>{generalDataGB}G</strong>
                <span>通用流量</span>
              </div>
              <div className="spec">
                <strong>{callMinutes}</strong>
                <span>通话分钟</span>
              </div>
            </div>
          </section>

          <section className="detail-panel">
            <div className="section-header">
              <div>
                <h2 className="section-title">办理区域</h2>
                <p className="section-note">不同地区可能有不同办理规则，提交前请再次核对收货地和归属地限制。</p>
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
                <h2 className="section-title">办理规则</h2>
                <p className="section-note">这些规则会影响实际资费和能否办理，提交资料前要看清楚。</p>
              </div>
              <Clock size={30} />
            </div>
            <ul className="notice-list">
              {product.rule ? <li>{product.rule}</li> : null}
              <li>{product.firstRechargeAmount ? `首充要求：${product.firstRechargeAmount} 元。` : "首充要求以办理页展示为准。"}</li>
              <li>年龄范围：{age1}-{age2} 岁。</li>
              <li>{product.numberSel > 0 ? "支持选号，具体可选号码以办理页为准。" : "暂不支持选号。"}</li>
            </ul>
          </section>

          <section className="detail-panel">
            <div className="section-header">
              <div>
                <h2 className="section-title">办理前确认</h2>
                <p className="section-note">重点确认不能办的地区、优惠期和套餐外资费。</p>
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
            <h2 className="section-title">立即办理</h2>
            <dl className="kv-list">
              <div className="kv">
                <dt>月租</dt>
                <dd>{monthlyRent}元</dd>
              </div>
              <div className="kv">
                <dt>通用流量</dt>
                <dd>{generalDataGB}G</dd>
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
              {orderLink?.shareUrl ? (
                <TrackButton productId={product.productID} productName={product.productName} href={orderLink.shareUrl} source="product_detail" label="去办理" />
              ) : (
                <Link className="button small" href="/">
                  返回列表重新选择
                </Link>
              )}
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
