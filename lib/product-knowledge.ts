import { getProductOverride } from "@/lib/product-overrides";
import {
  deriveCities,
  deriveScenes,
  detectProductCategory,
  parseCallMinutes,
  parseAverageMonthlyCost,
  parseBillingPeriodMonths,
  parseData,
  parseFirstRechargeAmount,
  parseIsLongTerm,
  parseMonthlyRent,
  parsePostPromoMonthlyRent,
  parsePrepaidAmount,
  parsePriceTime
} from "@/lib/product-parser";
import type { CardProduct, ProductStatus } from "@/lib/types";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function productText(product: CardProduct) {
  return [
    product.productName,
    product.area,
    product.taocan,
    product.rule,
    product.priceTime,
    product.tags.join(" "),
    product.skus.map((sku) => `${sku.name} ${sku.description}`).join(" ")
  ].join(" ");
}

function cleanConsumerText(value: string) {
  return value
    .split(/(?<=[。；;])|(?<=，)|(?<=,)/)
    .map((part) => part.trim())
    .filter((part) => part && (/禁止|禁发|不发|不支持|不可|不能|仅限|限制|限办|年龄|首充|实名|激活|注销|违约/.test(part) || !/(前端|推广|公域|私域|佣金|返佣|结算|原产品标记)/.test(part)))
    .join("")
    .replace(/，。/g, "。")
    .replace(/,{2,}/g, ",")
    .replace(/[，,；;]+$/g, "")
    .trim();
}

function cleanProductName(value: string) {
  return value
    .replace(/^【新】/, "")
    .replace(/\s*[|｜]\s*更改.*$/g, "")
    .trim();
}

const cityProvince: Record<string, string> = {
  shenzhen: "广东",
  guangzhou: "广东",
  dongguan: "广东"
};

const localCityWords: Record<string, string> = {
  shenzhen: "深圳",
  guangzhou: "广州",
  dongguan: "东莞",
  beijing: "北京",
  tianjin: "天津",
  chongqing: "重庆",
  weifang: "潍坊"
};

const provinceWords = [
  "北京",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "辽宁",
  "吉林",
  "黑龙江",
  "上海",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "广西",
  "海南",
  "重庆",
  "四川",
  "贵州",
  "云南",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆"
];

export function enrichProduct(product: CardProduct): CardProduct {
  const override = getProductOverride(product.productID);
  const text = productText(product);
  const category = override?.category ?? product.category ?? detectProductCategory(text);
  const hasRentAmbiguity = product.validationIssues?.some((issue) => /^月租(?:冲突|金额含义待核对)/.test(issue));
  const monthlyRent = hasRentAmbiguity ? undefined : product.monthlyRent ?? parseMonthlyRent(text);
  const postPromoMonthlyRent = product.postPromoMonthlyRent ?? parsePostPromoMonthlyRent(text);
  const averageMonthlyCost = product.averageMonthlyCost ?? parseAverageMonthlyCost(text);
  const prepaidAmount = product.prepaidAmount ?? parsePrepaidAmount(text);
  const billingPeriodMonths = product.billingPeriodMonths ?? parseBillingPeriodMonths(text);
  const data = parseData(text, product.dataGB);
  const dataGB = product.dataGB ?? data.total;
  const callMinutes = product.callMinutes ?? parseCallMinutes(text);
  const priceTime = product.priceTime === "待确认" ? parsePriceTime(text, product.priceTime) : product.priceTime;
  const isLongTerm = product.isLongTerm ?? parseIsLongTerm(priceTime) ?? parseIsLongTerm(`${product.taocan} ${product.rule}`);
  const parsedScenes = deriveScenes({
    text,
    monthlyRent,
    dataGB,
    callMinutes,
    age1: product.age1,
    age2: product.age2,
    isLongTerm
  });
  const status: ProductStatus = override?.hidden ? "hidden" : override?.status ?? product.status ?? (product.flag ? "active" : "inactive");
  const firstRechargeAmount = product.firstRechargeAmount ?? parseFirstRechargeAmount(text);
  const factSources = { ...product.factSources };
  for (const [field, value] of Object.entries({ monthlyRent, postPromoMonthlyRent, averageMonthlyCost, prepaidAmount, billingPeriodMonths, dataGB, generalDataGB: product.generalDataGB ?? data.general, directedDataGB: product.directedDataGB ?? data.directed, callMinutes, firstRechargeAmount })) {
    if (value !== undefined && !factSources[field]) {
      factSources[field] = product[field as keyof CardProduct] !== undefined ? "商品资料" : "套餐文本";
    }
  }

  return {
    ...product,
    productName: cleanProductName(product.productName),
    taocan: cleanConsumerText(product.taocan),
    rule: cleanConsumerText(product.rule),
    eligibilityText: product.eligibilityText ?? [product.productName, product.area, product.disableArea.join("、"), product.taocan, product.rule, product.skus.map((sku) => `${sku.name} ${sku.description}`).join(" ")].join(" "),
    monthlyRent,
    postPromoMonthlyRent,
    averageMonthlyCost,
    prepaidAmount,
    billingPeriodMonths,
    dataGB,
    generalDataGB: product.generalDataGB ?? data.general,
    directedDataGB: product.directedDataGB ?? data.directed,
    callMinutes,
    firstRechargeAmount,
    factSources,
    category,
    status,
    isLongTerm,
    priceTime,
    priority: override?.priority ?? product.priority ?? 50,
    scenes: unique([...(override?.scenes ?? []), ...product.scenes, ...parsedScenes]),
    cities: unique([...(override?.cities ?? []), ...product.cities, ...deriveCities(text)]),
    sellingPoints: unique([...(override?.sellingPoints ?? []), ...(product.sellingPoints ?? []), ...product.tags]),
    warnings: unique([...(override?.warnings ?? []), ...product.warnings])
  };
}

export function enrichProducts(products: CardProduct[]) {
  return products.map(enrichProduct);
}

export function getRecommendableProducts(products: CardProduct[]) {
  return enrichProducts(products).filter((product) => product.category === "mobile-card" && product.status === "active" && (product.generalDataGB ?? product.dataGB ?? 0) >= 30);
}

export function isCityCompatible(product: CardProduct, city?: string) {
  if (!city) {
    return true;
  }

  const targetProvince = cityProvince[city];
  const text = [product.productName, product.area, product.taocan, product.skus.map((sku) => `${sku.name} ${sku.description}`).join(" ")].join(" ");
  const mentionedProvince = provinceWords.find((province) => text.includes(province));
  const hasLocalLimit = /省内|本地|专属|专享|归属地|本省|仅限|限定|仅发/.test(text);
  const targetCityWord = localCityWords[city];
  const mentionedCity = Object.entries(localCityWords).find(([, word]) => text.includes(word));

  if (targetCityWord && mentionedCity && mentionedCity[1] !== targetCityWord && hasLocalLimit) {
    return false;
  }

  if (targetProvince && mentionedProvince && mentionedProvince !== targetProvince && hasLocalLimit) {
    return false;
  }

  if (product.cities.includes(city)) {
    return true;
  }

  if (product.area.includes("全国")) {
    return true;
  }

  if (["shenzhen", "guangzhou", "dongguan"].includes(city) && product.area.includes("广东")) {
    return true;
  }

  return false;
}

export function getCatalogStats(products: CardProduct[]) {
  const enriched = enrichProducts(products);
  const recommendable = enriched.filter((product) => product.category === "mobile-card" && product.status === "active" && (product.generalDataGB ?? product.dataGB ?? 0) >= 30);

  return {
    total: enriched.length,
    recommendable: recommendable.length,
    broadband: enriched.filter((product) => product.category === "broadband").length,
    inactive: enriched.filter((product) => product.status !== "active").length,
    unknown: enriched.filter((product) => product.category === "unknown").length
  };
}
