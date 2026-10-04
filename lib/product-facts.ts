import type { Haoka172OrderLink } from "@/lib/haoka172-order-links";
import { enrichProduct } from "@/lib/product-knowledge";
import { getMonthlyRentCandidates } from "@/lib/product-parser";
import type { CardProduct } from "@/lib/types";

const numericLabels = {
  monthlyRent: "月租",
  postPromoMonthlyRent: "优惠结束后月租",
  averageMonthlyCost: "月均费用",
  prepaidAmount: "预付金额",
  billingPeriodMonths: "计费周期月数",
  dataGB: "总流量",
  generalDataGB: "通用流量",
  directedDataGB: "定向流量",
  callMinutes: "通话分钟",
  firstRechargeAmount: "首充金额",
  age1: "最低办理年龄",
  age2: "最高办理年龄"
} as const;

type NumericFact = keyof typeof numericLabels;

function isAbsent(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

function readNumber(value: unknown, age = false) {
  if (isAbsent(value) || (typeof value !== "number" && typeof value !== "string")) {
    return undefined;
  }
  if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value.trim())) {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (age && (!Number.isInteger(number) || number > 120))) {
    return undefined;
  }
  return number;
}

function validTimestamp(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}

function sourceLabel(name: string, updatedAt?: string) {
  return updatedAt && !name.includes("更新于") ? `${name}（更新于 ${updatedAt}）` : name;
}

/** 合并已知事实；空值保持未知，有歧义的费用不参与价格筛选。 */
export function getValidatedProduct(product: CardProduct, orderLink?: Haoka172OrderLink): CardProduct {
  const enriched = enrichProduct(product);
  const result: CardProduct = { ...enriched, factSources: { ...enriched.factSources } };
  const sources = result.factSources!;
  const issues = new Set(enriched.validationIssues ?? []);
  const productUpdatedAt = validTimestamp(product.updatedAt);
  let orderUpdatedAt = validTimestamp(orderLink?.updatedAt);
  let usedOrderFacts = false;
  const textRentCandidates = getMonthlyRentCandidates(enriched.eligibilityText ?? [product.productName, product.taocan, product.rule].join(" "));
  let rentIsAmbiguous = textRentCandidates.length > 1 || [...issues].some((issue) => /^月租(?:冲突|金额含义待核对)/.test(issue));
  if (textRentCandidates.length > 1) issues.add(`月租冲突：套餐文本包含 ${textRentCandidates.join("、")} 元，需核对`);

  for (const field of Object.keys(numericLabels) as NumericFact[]) {
    const original = enriched[field];
    const value = readNumber(original, field === "age1" || field === "age2");
    result[field] = value;
    if (value !== undefined) {
      sources[field] = sourceLabel(sources[field] ?? "商品资料", productUpdatedAt);
    } else {
      delete sources[field];
      if (!isAbsent(original)) {
        issues.add(`${numericLabels[field]}无效，待核对`);
      }
    }
  }
  if (typeof result.isLongTerm === "boolean") {
    sources.isLongTerm = sourceLabel(sources.isLongTerm ?? "套餐文本", productUpdatedAt);
  }
  if (result.priceTime && result.priceTime !== "待确认") {
    sources.priceTime = sourceLabel(sources.priceTime ?? "商品资料", productUpdatedAt);
  }
  if (result.billingPeriodMonths !== undefined && (!Number.isInteger(result.billingPeriodMonths) || result.billingPeriodMonths < 1)) {
    issues.add("计费周期月数无效，待核对");
    result.billingPeriodMonths = undefined;
    delete sources.billingPeriodMonths;
  }

  if (result.age1 !== undefined && result.age2 !== undefined && result.age1 > result.age2) {
    issues.add("商品资料的办理年龄范围无效，待核对");
    result.age1 = undefined;
    result.age2 = undefined;
    delete sources.age1;
    delete sources.age2;
  }

  if (orderLink && orderLink.productID !== product.productID) {
    issues.add("办理接口商品与当前商品不一致，未采用其套餐数据");
    orderLink = undefined;
    orderUpdatedAt = undefined;
  }

  if (orderLink) {
    const orderFields = ["monthlyRent", "generalDataGB", "directedDataGB", "callMinutes", "age1", "age2"] as const;
    const orderAge1 = readNumber(orderLink.age1, true);
    const orderAge2 = readNumber(orderLink.age2, true);
    const invalidOrderAgeRange = orderAge1 !== undefined && orderAge2 !== undefined && orderAge1 > orderAge2;
    if (invalidOrderAgeRange) {
      issues.add("办理接口的年龄范围无效，待核对");
    }
    for (const field of orderFields) {
      const original = orderLink[field];
      const isAge = field === "age1" || field === "age2";
      const value = readNumber(original, isAge);
      if (isAge && invalidOrderAgeRange) {
        continue;
      }
      if (value === undefined) {
        if (!isAbsent(original)) {
          issues.add(`办理接口的${numericLabels[field]}无效，待核对`);
        }
        continue;
      }
      if (result[field] !== undefined && result[field] !== value) {
        issues.add(`${numericLabels[field]}冲突：商品资料 ${result[field]}，办理接口 ${value}，需核对`);
        if (field === "monthlyRent") rentIsAmbiguous = true;
      }
      if (field === "monthlyRent" && result.monthlyRent === undefined && (
        result.averageMonthlyCost !== undefined ||
        (result.billingPeriodMonths !== undefined && result.billingPeriodMonths > 1) ||
        value === result.firstRechargeAmount || value === result.prepaidAmount
      )) {
        rentIsAmbiguous = true;
        issues.add(`月租金额含义待核对：办理接口价格 ${value} 元，商品另含月均、首充或预付信息，不能直接视为月租`);
      }
      if (field === "monthlyRent" && rentIsAmbiguous) {
        result.monthlyRent = undefined;
        sources.monthlyRent = "套餐文本与办理接口待核对";
        continue;
      }
      result[field] = value;
      sources[field] = sourceLabel("办理接口", orderUpdatedAt);
      usedOrderFacts = true;
    }
  }
  if (rentIsAmbiguous) {
    result.monthlyRent = undefined;
    sources.monthlyRent = "套餐文本与办理接口待核对";
  }

  if (result.age1 !== undefined && result.age2 !== undefined && result.age1 > result.age2) {
    issues.add("合并后的办理年龄范围冲突，待核对");
    result.age1 = undefined;
    result.age2 = undefined;
    delete sources.age1;
    delete sources.age2;
  }

  // 只有两种流量都已明确，才可计算合计；总量永远不反填通用流量。
  if (result.generalDataGB !== undefined && result.directedDataGB !== undefined) {
    const total = result.generalDataGB + result.directedDataGB;
    if (result.dataGB !== undefined && result.dataGB !== total) {
      issues.add(`总流量冲突：商品资料 ${result.dataGB}，通用与定向合计 ${total}，需核对`);
    }
    result.dataGB = total;
    sources.dataGB = "通用与定向流量合计";
  }

  const timestamps = [productUpdatedAt, usedOrderFacts ? orderUpdatedAt : undefined].filter((value): value is string => Boolean(value));
  // 使用较早的资料时间，不让较新的办理链接掩盖旧的套餐规则。
  result.updatedAt = timestamps.length ? timestamps.sort()[0] : undefined;
  result.dataFreshnessCheckedAt = new Date().toISOString();
  result.dataFreshness = result.updatedAt ? (Date.now() - Date.parse(result.updatedAt) <= 30 * 60 * 1000 ? "fresh" : "stale") : "unknown";
  if (sources.dataGB === "通用与定向流量合计") {
    sources.dataGB = sourceLabel(sources.dataGB, result.updatedAt);
  }
  result.validationIssues = [...issues];
  return result;
}
