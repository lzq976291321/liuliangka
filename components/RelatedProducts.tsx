"use client";

import type { CardProduct } from "@/lib/types";
import { rankProducts } from "@/lib/recommendation";
import { ProductCard } from "@/components/ProductCard";
import { getAgeInputError, requirementsHref, toEligibilityContext, useCustomerRequirements, type CustomerRequirements } from "@/components/EligibilityControls";

export function RelatedProducts({ products, channelQuery, initialRequirements }: { products: CardProduct[]; channelQuery: string; initialRequirements: CustomerRequirements }) {
  const [requirements, , ready] = useCustomerRequirements(initialRequirements);
  const related = getAgeInputError(requirements.age) ? [] : rankProducts(products, toEligibilityContext(requirements)).slice(0, 3);
  const query = requirementsHref(`/${channelQuery ? `?${channelQuery}` : ""}`, requirements).split("?")[1];
  if (!ready) return <p>正在恢复办理条件…</p>;
  return <div className="product-grid">{related.length ? related.map(({ product, result }) => <ProductCard key={product.productID} product={product} reasons={result.reasons} score={result.score} detailQuery={query} />) : <p>暂无符合已知条件的其他套餐，返回列表调整条件。</p>}</div>;
}
