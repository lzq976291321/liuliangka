"use client";

import type { CardProduct } from "@/lib/types";
import { evaluateEligibility } from "@/lib/product-eligibility";
import { EligibilityControls, getAgeInputError, toEligibilityContext, useCustomerRequirements, type CustomerRequirements } from "@/components/EligibilityControls";
import { TrackButton } from "@/components/TrackButton";

export function ProductEligibilityPanel({ product, orderUrl, initialRequirements }: { product: CardProduct; orderUrl: string; initialRequirements: CustomerRequirements }) {
  const [requirements, setRequirements, ready] = useCustomerRequirements(initialRequirements);
  const result = evaluateEligibility(product, toEligibilityContext(requirements));
  const ageError = getAgeInputError(requirements.age);
  return <section className="detail-panel" id="apply-panel">
    <h2 className="section-title">核对后办理</h2>
    <EligibilityControls value={requirements} onChange={setRequirements} idPrefix="detail" />
    <div className={`eligibility-result ${result.status}`} aria-live="polite"><strong>{result.status === "eligible" ? "已知条件符合" : result.status === "ineligible" ? "不符合办理条件" : "办理条件待确认"}</strong><span>{ageError || result.reasons.join("；")}</span></div>
    {!ready || ageError || result.status === "ineligible" ? <button type="button" className="button green" disabled>{ready ? "当前条件无法办理" : "正在恢复办理条件…"}</button> : <TrackButton productId={product.productID} productName={product.productName} href={orderUrl} source="product_detail" label="去办理" />}
  </section>;
}
