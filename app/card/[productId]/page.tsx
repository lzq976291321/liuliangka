import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, Clock, MapPinned } from "lucide-react";
import { RelatedProducts } from "@/components/RelatedProducts";
import { RemoteImage } from "@/components/RemoteImage";
import { ProductEligibilityPanel } from "@/components/ProductEligibilityPanel";
import { getValidatedProduct } from "@/lib/product-facts";
import { formatValue, formatAge, formatUpdatedAt, isProductStale } from "@/lib/product-display";
import { getAllProducts, getOrderLinks, getProductById } from "@/lib/catalog-source";



type ProductPageProps = {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { productId } = await params;
  const [rawProduct, orderLinks] = await Promise.all([getProductById(productId), getOrderLinks()]);
  const product = rawProduct ? getValidatedProduct(rawProduct, orderLinks.get(rawProduct.productID)) : undefined;
  if (!product) {
    return {};
  }

  return {
    title: `${product.productName}套餐详情`,
    description: `${product.productName}：${formatValue(product.monthlyRent, "元/月")}，整理通用流量、办理限制、禁发区域和注意事项。`,
    keywords: [product.productName, `${product.operator}流量卡`, "流量卡套餐详情"]
  };
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { productId } = await params;
  const query = await searchParams;
  const initialRequirements = { province: typeof query.province === "string" ? query.province : "", city: typeof query.city === "string" ? query.city : "", age: typeof query.age === "string" ? query.age : "" };
  const [allProducts, orderLinks] = await Promise.all([getAllProducts(), getOrderLinks()]);
  const products = allProducts.map((item) => getValidatedProduct(item, orderLinks.get(item.productID))).filter((item) => item.flag && item.status === "active");
  const product = products.find((item) => String(item.productID) === productId);
  const orderLink = orderLinks.get(Number(productId));
  if (!product || !orderLink?.shareUrl || !orderLink.pudId || !orderLink.userId) notFound();
  const relatedQuery = new URLSearchParams();
  for (const key of ["province", "city", "age", "channel", "agent_id", "invite"]) {
    if (typeof query[key] === "string") relatedQuery.set(key, query[key]);
  }
  const related = products.filter((item) => item.productID !== product.productID && item.category === "mobile-card" && Boolean(orderLinks.get(item.productID)?.pudId && orderLinks.get(item.productID)?.userId));

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
                <strong>{formatValue(product.monthlyRent, "元")}</strong>
                <span>月租</span>
              </div>
              <div className="spec">
                <strong>{formatValue(product.generalDataGB, "G")}</strong>
                <span>通用流量</span>
              </div>
              <div className="spec">
                <strong>{formatValue(product.callMinutes)}</strong>
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
            {!product.skus.length ? <p className="section-note">具体发货范围待确认，请填写收货地核对已知限制。</p> : null}
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
              <li>{product.firstRechargeAmount !== undefined ? `首充要求：${product.firstRechargeAmount} 元。` : "首充要求待确认。"}</li>
              {product.averageMonthlyCost !== undefined ? <li>平均每月费用：{product.averageMonthlyCost} 元（请核对实际扣费和充值规则）。</li> : null}
              {product.prepaidAmount !== undefined ? <li>预付金额：{product.prepaidAmount} 元{product.billingPeriodMonths ? `，覆盖 ${product.billingPeriodMonths} 个月` : ""}。</li> : null}
              <li>优惠结束后月租：{formatValue(product.postPromoMonthlyRent, "元/月")}。</li>
              <li>年龄范围：{formatAge(product.age1, product.age2)}。</li>
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
              {product.validationIssues?.map((issue) => <li className="fact-notice" key={issue}>{issue}</li>)}
              {product.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
              <li>禁发区域：{product.disableArea.join("、") || "待确认（未提供禁发信息）"}。</li>
            </ul>
          </section>
        </section>

        <aside className="sticky-aside">
          <ProductEligibilityPanel product={product} orderUrl={orderLink.shareUrl} initialRequirements={initialRequirements} />
          <section className="detail-panel">
            <h2 className="section-title">套餐资料</h2>
            <p className="product-updated">更新：{formatUpdatedAt(product.updatedAt)}{isProductStale(product.updatedAt) ? " · 待更新核对" : ""}</p>
            <details className="fact-sources"><summary>查看信息来源</summary><dl>{Object.entries(product.factSources ?? {}).map(([key, source]) => <div key={key}><dt>{({ monthlyRent: "月租", averageMonthlyCost: "平均每月费用", prepaidAmount: "预付金额", billingPeriodMonths: "计费周期", isLongTerm: "是否长期", postPromoMonthlyRent: "优惠结束后月租", generalDataGB: "通用流量", directedDataGB: "定向流量", dataGB: "总流量", callMinutes: "通话", age1: "最低年龄", age2: "最高年龄", firstRechargeAmount: "首充", priceTime: "优惠期限", age: "年龄范围" } as Record<string, string>)[key] || key}</dt><dd>{source}</dd></div>)}</dl></details>
          </section>
        </aside>
      </div>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">其他套餐</h2>
            <p className="section-note">保留当前办理条件，继续查看其他套餐。</p>
          </div>
        </div>
        <RelatedProducts products={related} channelQuery={relatedQuery.toString()} initialRequirements={initialRequirements} />
      </section>
    </main>
  );
}
