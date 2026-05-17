import type { CardProduct, RecommendationContext } from "@/lib/types";

const longTermWords = ["长期", "二十年", "官方可查", "存费形成长期"];

export function scoreProduct(product: CardProduct, context: RecommendationContext = {}) {
  let score = 50;
  const reasons: string[] = [];

  if (!product.flag) {
    return { score: 0, reasons: ["当前已下架"] };
  }

  if (context.city && product.cities.includes(context.city)) {
    score += 12;
    reasons.push("目标地区可办");
  }

  if (context.scene && product.scenes.includes(context.scene)) {
    score += 14;
    reasons.push("匹配使用场景");
  }

  if (typeof context.budget === "number") {
    if (product.monthlyRent <= context.budget) {
      score += 12;
      reasons.push("月租在预算内");
    } else {
      score -= Math.min(12, product.monthlyRent - context.budget);
    }
  }

  if (typeof context.dataNeedGB === "number") {
    if (product.dataGB >= context.dataNeedGB) {
      score += 10;
      reasons.push("流量余量充足");
    } else {
      score -= Math.min(18, context.dataNeedGB - product.dataGB);
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

  if (typeof context.age === "number") {
    if (context.age >= product.age1 && context.age <= product.age2) {
      score += 8;
      reasons.push("年龄符合办理范围");
    } else {
      score -= 30;
      reasons.push("年龄可能不符合");
    }
  }

  if (longTermWords.some((word) => product.priceTime.includes(word))) {
    score += 12;
    reasons.push("长期属性更强");
  }

  if (product.numberSel > 0) {
    score += 4;
    reasons.push("支持选号");
  }

  if (product.commission >= 200) {
    score += 5;
    reasons.push("高佣优先测试");
  }

  score -= Math.min(10, product.disableArea.length * 2);

  return {
    score: Math.max(0, Math.min(99, Math.round(score))),
    reasons: reasons.slice(0, 4)
  };
}

export function rankProducts(products: CardProduct[], context: RecommendationContext = {}) {
  return [...products]
    .map((product) => ({ product, result: scoreProduct(product, context) }))
    .sort((a, b) => b.result.score - a.result.score);
}
