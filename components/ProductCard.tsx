import { ArrowRight, BadgeCheck, RadioTower } from "lucide-react";
import Link from "next/link";
import { RemoteImage } from "@/components/RemoteImage";
import type { CardProduct } from "@/lib/types";

type ProductCardProps = {
  product: CardProduct;
  score?: number;
  reasons?: string[];
};

export function ProductCard({ product, score, reasons = [] }: ProductCardProps) {
  return (
    <article className="product-card">
      <div className="product-media">
        <RemoteImage src={product.mainPic} alt={product.productName} />
        {typeof score === "number" ? <span className="score-badge">推荐 {score}</span> : null}
      </div>
      <div className="product-body">
        <div className="product-topline">
          <span className="tag green">{product.operator}</span>
          <span className="tag amber">{product.priceTime}</span>
          <span className="tag">{product.backMoneyType}</span>
        </div>
        <h3 className="product-name">{product.productName}</h3>
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
            <strong>{product.age1}-{product.age2}</strong>
            <span>年龄</span>
          </div>
        </div>
        <p className="product-summary">{product.taocan}</p>
        {reasons.length ? (
          <div className="product-topline">
            {reasons.map((reason) => (
              <span className="tag" key={reason}>
                <BadgeCheck size={13} />
                {reason}
              </span>
            ))}
          </div>
        ) : null}
        <div className="product-actions">
          <Link className="button small primary" href={`/card/${product.productID}`}>
            <RadioTower size={16} />
            看详情
          </Link>
          <Link className="button small" href={`/assistant?product=${product.productID}`}>
            匹配场景
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
