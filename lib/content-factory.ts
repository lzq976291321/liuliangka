import { channelConfigs, getCampaignUrl } from "@/lib/campaign";
import type { ScenarioConfig } from "@/lib/scenarios";
import type { CardProduct } from "@/lib/types";

type RankedProduct = {
  product: CardProduct;
  result: {
    score: number;
    reasons: string[];
  };
};

export type GeneratedContentPackage = {
  slug: string;
  keyword: string;
  title: string;
  path: string;
  posterPath: string;
  primaryProductName: string;
  seoTitle: string;
  seoDescription: string;
  pageIntro: string;
  zhihuTitle: string;
  zhihuBody: string;
  xhsTitle: string;
  xhsBody: string;
  videoScript: string;
  posterHeadline: string;
  posterSubline: string;
  faqText: string;
  products: Array<{
    id: number;
    name: string;
    operator: string;
    monthlyRent: number;
    dataGB: number;
    priceTime: string;
    score: number;
    reasons: string[];
  }>;
  links: Array<{
    label: string;
    source: string;
    play: string;
    url: string;
  }>;
};

function productLine(item: RankedProduct, index: number) {
  const { product, result } = item;
  return `${index + 1}. ${product.productName}：${product.monthlyRent}元/月，${product.dataGB}G，${product.operator}，${product.priceTime}。推荐理由：${result.reasons.join("、") || "规则相对清楚"}。`;
}

function buildRiskNote(products: RankedProduct[]) {
  const disableCount = products.reduce((total, item) => total + item.product.disableArea.length, 0);
  const ageRanges = products.map((item) => `${item.product.productName}${item.product.age1}-${item.product.age2}岁`).join("；");

  return `办理前重点核对禁发区域、年龄限制、优惠期和首充规则。当前候选套餐共涉及 ${disableCount} 条禁发区域提示，年龄范围参考：${ageRanges}。`;
}

export function generateContentPackage(scenario: ScenarioConfig, rankedProducts: RankedProduct[]): GeneratedContentPackage {
  const topProducts = rankedProducts.slice(0, 3);
  const primary = topProducts[0]?.product;
  const path = `/liuliangka/${scenario.slug}`;
  const posterPath = `/poster/${scenario.slug}`;
  const primaryContent = String(primary?.productID ?? "none");
  const comparison = topProducts.map(productLine).join("\n");
  const riskNote = buildRiskNote(topProducts);
  const primaryName = primary?.productName ?? "待补充套餐";
  const primarySummary = primary ? `${primary.monthlyRent}元/月，${primary.dataGB}G，${primary.operator}` : "待补充月租、流量和运营商";
  const channels = channelConfigs.map((channel) => ({
    label: channel.label,
    source: channel.source,
    play: channel.play,
    url: getCampaignUrl(path, channel.source, scenario.slug, primaryContent)
  }));

  const seoTitle = `${scenario.keyword}：${primaryName}等 3 款套餐对比`;
  const seoDescription = `${scenario.description} 对比月租、流量、运营商、优惠期、年龄限制和禁发区域，优先推荐规则清楚、适合办理的套餐。`;
  const pageIntro = `${scenario.shortTitle}用户优先看三件事：常住地是否可办、流量是不是通用、优惠期是否足够稳定。当前主推 ${primaryName}（${primarySummary}），页面保留套餐对比和办理前注意，减少只看低价导致的踩坑。`;

  const zhihuTitle = `${scenario.keyword}怎么选？这几类套餐先看清楚`;
  const zhihuBody = [
    `${scenario.keyword}不要只看标题里的总流量，真正要比较的是月租、通用流量、优惠期、禁发区域和年龄限制。`,
    "",
    "我会先按这个顺序筛：",
    "1. 常住地是否可办，尤其是禁发区域和收货地限制。",
    "2. 月租是否在预算内，优惠期结束后是否会明显涨价。",
    "3. 通用流量够不够，定向流量不要当成全部可用流量。",
    "4. 是否需要通话分钟、选号、长期属性。",
    "",
    "当前更值得先看的几张：",
    comparison,
    "",
    riskNote,
    "",
    "完整对比入口：发布时粘贴内容工厂上方复制的渠道链接，不建议在正文里裸露长链接。"
  ].join("\n");

  const xhsTitle = `${scenario.keyword}｜先看这 3 张`;
  const xhsBody = [
    `${scenario.keyword}别只看“多少 G”，先看能不能办、优惠期多久、通用流量多少。`,
    "",
    topProducts.map((item, index) => `${index + 1}. ${item.product.productName}：${item.product.monthlyRent}元 / ${item.product.dataGB}G / ${item.product.operator}`).join("\n"),
    "",
    "适合：",
    scenario.audience.map((item) => `- ${item}`).join("\n"),
    "",
    "避坑：",
    "- 禁发区域先确认",
    "- 优惠期和首充规则先确认",
    "- 主力卡优先长期属性",
    "",
    `#${scenario.keyword.replace(/\s/g, "")} #流量卡推荐 #低月租大流量卡 #手机卡套餐`
  ].join("\n");

  const videoScript = [
    `开头 3 秒：还在搜${scenario.keyword}？别直接办标题最夸张的那张。`,
    `中段：先看地区可办、月租、通用流量和优惠期。比如当前优先看 ${primaryName}，核心参数是 ${primarySummary}。`,
    `对比：备选还有 ${topProducts.slice(1).map((item) => item.product.productName).join("、") || "其他同类套餐"}，适合不同预算和使用场景。`,
    "结尾：办理前一定核对禁发区域、年龄和首充规则，完整对比看评论区链接。"
  ].join("\n");

  const faqText = scenario.faq.map((item) => `Q：${item.question}\nA：${item.answer}`).join("\n\n");

  return {
    slug: scenario.slug,
    keyword: scenario.keyword,
    title: scenario.title,
    path,
    posterPath,
    primaryProductName: primaryName,
    seoTitle,
    seoDescription,
    pageIntro,
    zhihuTitle,
    zhihuBody,
    xhsTitle,
    xhsBody,
    videoScript,
    posterHeadline: `${scenario.shortTitle}先看这 3 张卡`,
    posterSubline: primary ? `${primary.monthlyRent}元起 / 最高 ${Math.max(...topProducts.map((item) => item.product.dataGB))}G / ${primary.priceTime}` : "按月租、流量和地区限制筛选",
    faqText,
    products: topProducts.map(({ product, result }) => ({
      id: product.productID,
      name: product.productName,
      operator: product.operator,
      monthlyRent: product.monthlyRent,
      dataGB: product.dataGB,
      priceTime: product.priceTime,
      score: result.score,
      reasons: result.reasons
    })),
    links: channels
  };
}
