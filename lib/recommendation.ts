import { evaluateEligibility } from "@/lib/product-eligibility";
import type { CardProduct, RecommendationContext } from "@/lib/types";

export function scoreProduct(product: CardProduct, context: RecommendationContext = {}) {
  let score = 50;
  const reasons: string[] = [];
  const eligibility = evaluateEligibility(product, context);

  if (!product.flag || (product.status && product.status !== "active")) {
    return { score: 0, reasons: ["当前不可推荐"], eligibility: { status: "ineligible" as const, reasons: ["当前不可推荐"] } };
  }
  if (eligibility.status === "ineligible") return { score: 0, reasons: eligibility.reasons, eligibility };
  if (eligibility.status === "eligible") {
    score += 12;
    reasons.push(...eligibility.reasons);
  }

  if (context.scene && product.scenes.includes(context.scene)) {
    score += 14;
    reasons.push("符合所选使用场景");
  }
  if (typeof context.budget === "number" && Number.isFinite(product.monthlyRent)) {
    if (product.monthlyRent! <= context.budget) {
      score += 12;
      reasons.push("月租在预算内");
    } else {
      score -= Math.min(12, product.monthlyRent! - context.budget);
    }
  }
  // A total quota can include app-specific traffic, so compare the general quota only.
  if (typeof context.dataNeedGB === "number" && Number.isFinite(product.generalDataGB)) {
    if (product.generalDataGB! >= context.dataNeedGB) {
      score += 10;
      reasons.push("通用流量达到所需用量");
    } else {
      score -= Math.min(18, context.dataNeedGB - product.generalDataGB!);
    }
  }
  if (context.operator && context.operator !== "不限") {
    if (product.operator === context.operator) {
      score += 10;
      reasons.push(`偏好${context.operator}`);
    } else {
      score -= 6;
    }
  }
  if (product.isLongTerm === true) {
    score += 12;
    reasons.push("标注长期优惠");
  }
  if (product.numberSel > 0) {
    score += 4;
    reasons.push("支持选号");
  }
  return { score: Math.max(0, Math.min(99, Math.round(score))), reasons: reasons.slice(0, 4), eligibility };
}

export function rankProducts(products: CardProduct[], context: RecommendationContext = {}) {
  const hasEligibilityContext = Boolean(context.province || context.city || context.age !== undefined);
  return [...products]
    .map((product) => ({ product, result: scoreProduct(product, context) }))
    .filter(({ result }) => result.eligibility.status !== "ineligible" && (!hasEligibilityContext || result.eligibility.status === "eligible"))
    .sort((a, b) => b.result.score - a.result.score);
}
