import { scoreProduct } from "@/lib/recommendation";
import { isCityCompatible } from "@/lib/product-knowledge";
import type { CardProduct, GuideIntent } from "@/lib/types";

export type GuideRecommendation = {
  product: CardProduct;
  score: number;
  reasons: string[];
  risks: string[];
};

const cityLabels: Record<string, string> = {
  shenzhen: "深圳",
  guangzhou: "广州",
  dongguan: "东莞"
};

const sceneLabels: Record<string, string> = {
  cheap: "低月租",
  student: "学生党",
  "long-term": "长期主力卡",
  gaming: "打游戏",
  takeaway: "外卖跑腿",
  "live-stream": "直播短视频"
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extraScore(product: CardProduct, intent: GuideIntent) {
  let score = 0;
  const reasons: string[] = [];

  if (intent.needCallMinutes) {
    if (product.callMinutes >= 100) {
      score += 14;
      reasons.push("通话分钟更适合接单和联系");
    } else if (product.callMinutes === 0) {
      score -= 14;
      reasons.push("不含通话分钟，慎作主力卡");
    }
  }

  if (intent.preferLongTerm) {
    if (product.isLongTerm) {
      score += 12;
      reasons.push("长期属性更适合长期使用");
    } else {
      score -= 6;
    }
  }

  if (product.generalDataGB && intent.dataNeedGB && product.generalDataGB >= intent.dataNeedGB * 0.7) {
    score += 8;
    reasons.push("通用流量占比更稳");
  }

  if (product.firstRechargeAmount && product.firstRechargeAmount >= 100) {
    score -= 5;
  }

  score += Math.min(10, Math.max(0, (product.priority ?? 50) - 50) / 5);

  return { score, reasons };
}

function buildRisks(product: CardProduct) {
  const risks = [...product.warnings];

  if (!product.isLongTerm) {
    risks.push("优惠期不算特别长，主力卡要留意到期后资费");
  }

  if (product.firstRechargeAmount && product.firstRechargeAmount >= 100) {
    risks.push(`首充约 ${product.firstRechargeAmount} 元，办理前确认是否接受`);
  }

  if (product.disableArea.length) {
    risks.push(`有 ${product.disableArea.length} 项禁发区域，下单前先核对收货地`);
  }

  return unique(risks).slice(0, 4);
}

export function getGuideCandidateProducts(products: CardProduct[], intent: GuideIntent) {
  const cityMatched = products.filter((product) => isCityCompatible(product, intent.city));
  if (typeof intent.budget !== "number") {
    return cityMatched;
  }

  const budgetMatched = cityMatched.filter((product) => product.monthlyRent <= intent.budget!);
  return budgetMatched.length ? budgetMatched : cityMatched;
}

export function isGuideBudgetRelaxed(products: CardProduct[], intent: GuideIntent) {
  if (typeof intent.budget !== "number") {
    return false;
  }

  const cityMatched = products.filter((product) => isCityCompatible(product, intent.city));
  return cityMatched.length > 0 && cityMatched.every((product) => product.monthlyRent > intent.budget!);
}

export function recommendForGuide(products: CardProduct[], intent: GuideIntent): GuideRecommendation[] {
  return getGuideCandidateProducts(products, intent)
    .map((product) => {
      const base = scoreProduct(product, intent);
      const extra = extraScore(product, intent);
      const score = Math.max(0, Math.min(99, Math.round(base.score + extra.score)));

      return {
        product,
        score,
        reasons: unique([...base.reasons, ...extra.reasons, ...(product.sellingPoints ?? [])]).slice(0, 5),
        risks: buildRisks(product)
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function parseGuideText(text: string): GuideIntent {
  const intent: GuideIntent = { rawText: text };
  const normalized = text.trim();
  const budgetMatch = normalized.match(/(\d{2})\s*(?:元|块|以内|以下|左右)?/);
  const dataMatch = normalized.match(/(\d{2,3})\s*G/i);

  if (normalized.includes("深圳")) {
    intent.city = "shenzhen";
  } else if (normalized.includes("广州")) {
    intent.city = "guangzhou";
  } else if (normalized.includes("东莞")) {
    intent.city = "dongguan";
  }

  if (/外卖|跑腿|骑手|网约车|接单/.test(normalized)) {
    intent.scene = "takeaway";
    intent.needCallMinutes = true;
    intent.dataNeedGB = 180;
  } else if (/学生|大学|校园|宿舍/.test(normalized)) {
    intent.scene = "student";
    intent.budget = 29;
    intent.dataNeedGB = 120;
  } else if (/游戏|手游|热点/.test(normalized)) {
    intent.scene = "gaming";
    intent.dataNeedGB = 220;
  } else if (/直播|短视频|探店|上传/.test(normalized)) {
    intent.scene = "live-stream";
    intent.dataNeedGB = 260;
  } else if (/长期|主力|稳定|不想换/.test(normalized)) {
    intent.scene = "long-term";
    intent.preferLongTerm = true;
    intent.dataNeedGB = 180;
  } else if (/便宜|省钱|低月租|备用|副卡/.test(normalized)) {
    intent.scene = "cheap";
    intent.budget = 29;
    intent.dataNeedGB = 150;
  }

  if (/通话|电话|接单|骑手|外卖|跑腿/.test(normalized)) {
    intent.needCallMinutes = true;
  }

  if (/长期|主力|稳定|不想换/.test(normalized)) {
    intent.preferLongTerm = true;
  }

  if (budgetMatch) {
    const budget = Number(budgetMatch[1]);
    if (budget >= 10 && budget <= 99) {
      intent.budget = budget;
    }
  }

  if (dataMatch) {
    const dataNeedGB = Number(dataMatch[1]);
    if (dataNeedGB >= 30 && dataNeedGB <= 500) {
      intent.dataNeedGB = dataNeedGB;
    }
  }

  return intent;
}

export function describeIntent(intent: GuideIntent) {
  const parts = [
    intent.city ? cityLabels[intent.city] : undefined,
    intent.scene ? sceneLabels[intent.scene] : undefined,
    intent.budget ? `${intent.budget}元内` : undefined,
    intent.dataNeedGB ? `${intent.dataNeedGB}G左右` : undefined,
    intent.needCallMinutes ? "需要通话" : undefined,
    intent.preferLongTerm ? "偏长期" : undefined
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "先按低月租、大流量、限制少来选";
}
