import type { RecommendationContext } from "@/lib/types";

export type ScenarioConfig = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  keyword: string;
  context: RecommendationContext;
  audience: string[];
  faq: Array<{ question: string; answer: string }>;
};

export const scenarioConfigs: ScenarioConfig[] = [
  {
    slug: "shenzhen",
    title: "深圳流量卡推荐",
    shortTitle: "深圳",
    description: "优先筛选广东可发、低月租、大流量、适合租房和通勤场景的套餐。",
    keyword: "深圳流量卡推荐",
    context: { city: "shenzhen", budget: 39, dataNeedGB: 180 },
    audience: ["南山/福田通勤用户", "城中村租房用户", "双卡备用流量用户"],
    faq: [
      { question: "深圳办流量卡要优先看什么？", answer: "先看禁发地区、归属地、优惠期和本地运营商覆盖，再看月租和流量。" },
      { question: "深圳租房用户适合哪类卡？", answer: "更适合低月租、大通用流量、年龄限制宽、售后规则清楚的长期套餐。" }
    ]
  },
  {
    slug: "guangzhou",
    title: "广州流量卡推荐",
    shortTitle: "广州",
    description: "面向学生、通勤、直播和备用机用户，优先展示广东办理更稳的套餐。",
    keyword: "广州流量卡推荐",
    context: { city: "guangzhou", budget: 39, dataNeedGB: 160 },
    audience: ["大学城学生", "白云/番禺租房用户", "直播和短视频用户"],
    faq: [
      { question: "广州学生党适合长期卡吗？", answer: "如果预算稳定且会长期使用，长期套餐比短期优惠卡更适合。" },
      { question: "广州选号有必要吗？", answer: "有主号需求可以选支持选号的卡，只做副卡流量则不必优先选号。" }
    ]
  },
  {
    slug: "dongguan",
    title: "东莞流量卡推荐",
    shortTitle: "东莞",
    description: "适合工厂、出租屋、外卖跑腿和跨城通勤用户的高流量套餐对比。",
    keyword: "东莞流量卡推荐",
    context: { city: "dongguan", budget: 39, dataNeedGB: 180 },
    audience: ["出租屋宽带替代", "外卖跑腿用户", "深圳东莞双城通勤"],
    faq: [
      { question: "东莞出租屋能用流量卡替代宽带吗？", answer: "轻度使用可以，高频下载、多人共用或直播场景仍建议先测信号和稳定性。" },
      { question: "东莞外卖员应该看什么？", answer: "优先看通话分钟、流量是否通用、信号覆盖和套餐是否长期。" }
    ]
  },
  {
    slug: "student",
    title: "学生党流量卡推荐",
    shortTitle: "学生党",
    description: "按低月租、流量够用、年龄限制和优惠周期筛选适合学生的套餐。",
    keyword: "学生党流量卡",
    context: { scene: "student", budget: 29, dataNeedGB: 120, age: 20 },
    audience: ["大学生", "准大学生", "宿舍备用流量用户"],
    faq: [
      { question: "学生卡是不是一定更便宜？", answer: "不一定，关键看优惠期、首充规则和到期后的资费。" },
      { question: "学生党要避开什么卡？", answer: "避开优惠期太短、只写总流量不拆分通用/定向、售后规则不清楚的套餐。" }
    ]
  },
  {
    slug: "cheap",
    title: "低月租大流量卡推荐",
    shortTitle: "低月租",
    description: "围绕 19-39 元预算，筛选通用流量高、规则清楚、禁发少的套餐。",
    keyword: "低月租大流量卡",
    context: { scene: "cheap", budget: 29, dataNeedGB: 150 },
    audience: ["副卡用户", "备用机用户", "预算敏感用户"],
    faq: [
      { question: "29 元 200G 靠谱吗？", answer: "要看通用流量占比、优惠期、首充和是否官方可查，不能只看标题数字。" },
      { question: "低月租卡最常见的坑是什么？", answer: "短期优惠、定向流量占比高、首充后才生效、禁发地区没写清楚。" }
    ]
  },
  {
    slug: "long-term",
    title: "长期流量卡推荐",
    shortTitle: "长期套餐",
    description: "优先筛选官方可查长期、20 年优惠或可存费形成长期的套餐。",
    keyword: "长期流量卡",
    context: { scene: "long-term", budget: 49, dataNeedGB: 180 },
    audience: ["长期主力卡用户", "不想频繁换卡用户", "家庭备用流量用户"],
    faq: [
      { question: "长期套餐一定不变价吗？", answer: "不一定，要看官方可查、存费规则和优惠期描述，页面会优先标注这些字段。" },
      { question: "长期卡和短期卡怎么选？", answer: "主力号码优先长期卡，短期冲量或备用机可以考虑短期优惠卡。" }
    ]
  },
  {
    slug: "gaming",
    title: "打游戏流量卡推荐",
    shortTitle: "打游戏",
    description: "优先高通用流量、广东本地办理、稳定性更适合游戏和热点共享的套餐。",
    keyword: "打游戏流量卡",
    context: { scene: "gaming", budget: 49, dataNeedGB: 220 },
    audience: ["手游用户", "热点共享用户", "宿舍游戏用户"],
    faq: [
      { question: "游戏流量卡要看延迟吗？", answer: "要看常驻地点运营商覆盖，套餐流量多不代表游戏延迟一定低。" },
      { question: "游戏用户适合定向流量吗？", answer: "更建议看通用流量，定向流量对游戏和热点共享帮助有限。" }
    ]
  },
  {
    slug: "takeaway",
    title: "外卖跑腿流量卡推荐",
    shortTitle: "外卖跑腿",
    description: "适合外卖员、跑腿、网约车等高频定位、接单和通话场景。",
    keyword: "外卖员流量卡",
    context: { scene: "takeaway", budget: 39, dataNeedGB: 180 },
    audience: ["外卖员", "跑腿骑手", "网约车司机"],
    faq: [
      { question: "外卖员要不要选带通话的套餐？", answer: "建议优先选有通话分钟或通话资费清楚的套餐，接单沟通更稳。" },
      { question: "跑单用户最怕什么？", answer: "最怕信号覆盖不稳、流量虚标、套餐突然变价，所以要优先选规则清楚的长期套餐。" }
    ]
  }
];

export function getScenario(slug: string) {
  return scenarioConfigs.find((scenario) => scenario.slug === slug);
}
