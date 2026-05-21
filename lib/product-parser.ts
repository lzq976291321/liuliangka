import type { ProductCategory } from "@/lib/types";

const longTermWords = ["长期", "二十年", "20年", "二十 年", "官方可查", "存费形成长期", "永久"];
const broadbandWords = ["宽带", "单宽", "融合", "FTTR", "电视", "光猫"];
const mobileWords = ["流量", "通用", "定向", "手机卡", "电话卡", "月租", "选号", "通话"];

function numberFromMatch(match: RegExpMatchArray | null) {
  return match ? Number(match[1]) : undefined;
}

export function parseMonthlyRent(text: string, fallback = 39) {
  const monthly =
    numberFromMatch(text.match(/(?:月租|套餐|资费)?\s*(\d+(?:\.\d+)?)\s*元\s*(?:\/|每)?\s*月/)) ??
    numberFromMatch(text.match(/(\d+(?:\.\d+)?)\s*元\s*包月/)) ??
    numberFromMatch(text.match(/月租\s*(\d+(?:\.\d+)?)/)) ??
    numberFromMatch(text.match(/(?:首年|长期|优惠期|前\d+个月)?\s*(\d+(?:\.\d+)?)\s*元\s*\d+(?:\.\d+)?\s*G/i));

  if (typeof monthly === "number" && Number.isFinite(monthly)) {
    return Math.round(monthly);
  }

  const annual = numberFromMatch(text.match(/(\d+(?:\.\d+)?)\s*元\s*(?:\/|每)?\s*年/));
  if (typeof annual === "number" && Number.isFinite(annual)) {
    return Math.round(annual / 12);
  }

  return fallback;
}

export function parseData(text: string, fallback = 100) {
  const general = numberFromMatch(text.match(/(\d+(?:\.\d+)?)\s*G\s*(?:通用|全国通用|普通)/i));
  const directed = numberFromMatch(text.match(/(\d+(?:\.\d+)?)\s*G\s*(?:定向|专属|权益)/i));
  const allData = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*G/gi))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 2000);

  const totalFromParts = (general ?? 0) + (directed ?? 0);
  const total = totalFromParts > 0 ? totalFromParts : allData.length ? Math.max(...allData) : fallback;

  return {
    total: Math.round(total),
    general: typeof general === "number" ? Math.round(general) : undefined,
    directed: typeof directed === "number" ? Math.round(directed) : undefined
  };
}

export function parseCallMinutes(text: string, fallback = 0) {
  return Math.round(numberFromMatch(text.match(/(\d+(?:\.\d+)?)\s*分钟/)) ?? fallback);
}

export function parseFirstRechargeAmount(text: string) {
  return numberFromMatch(text.match(/首充\s*(\d+(?:\.\d+)?)\s*元?/));
}

export function parseIsLongTerm(text: string) {
  return longTermWords.some((word) => text.includes(word));
}

export function parsePriceTime(text: string, fallback = "待确认") {
  if (parseIsLongTerm(text)) {
    return "长期";
  }

  const yearMatch = text.match(/(\d+)\s*年|两年|二年/);
  if (yearMatch) {
    if (text.includes("两年") || text.includes("二年")) {
      return "两年";
    }
    return `${yearMatch[1]}年`;
  }

  if (text.includes("包年")) {
    return "一年";
  }

  if (text.includes("包月") || text.includes("月租") || /元\s*(?:\/|每)?\s*月/.test(text)) {
    return "按月";
  }

  return fallback;
}

export function detectProductCategory(text: string): ProductCategory {
  const hasBroadbandWord = broadbandWords.some((word) => text.includes(word));
  const hasMobileWord = mobileWords.some((word) => text.includes(word));
  const hasMobileData = /\d+(?:\.\d+)?\s*G/i.test(text);

  if (hasBroadbandWord && !hasMobileData) {
    return "broadband";
  }

  if (hasBroadbandWord && /(?:单宽|宽带包年|宽带\d+M|\d+M.*宽带)/i.test(text)) {
    return "broadband";
  }

  if (/\d+(?:\.\d+)?\s*M/i.test(text) && !hasMobileData) {
    return "broadband";
  }

  if (hasMobileWord || hasMobileData) {
    return "mobile-card";
  }

  return "unknown";
}

export function deriveScenes(input: {
  text: string;
  monthlyRent: number;
  dataGB: number;
  callMinutes: number;
  age1: number;
  age2: number;
  isLongTerm: boolean;
}) {
  const scenes = new Set<string>();
  const { text, monthlyRent, dataGB, callMinutes, age1, age2, isLongTerm } = input;

  if (monthlyRent <= 29 && dataGB >= 100) {
    scenes.add("cheap");
  }

  if (isLongTerm) {
    scenes.add("long-term");
  }

  if (text.includes("学生") || text.includes("校园") || (monthlyRent <= 29 && age1 <= 18 && age2 <= 35)) {
    scenes.add("student");
  }

  if (text.includes("游戏") || text.includes("电竞") || dataGB >= 220) {
    scenes.add("gaming");
  }

  if (text.includes("外卖") || text.includes("骑手") || text.includes("跑腿") || callMinutes >= 100) {
    scenes.add("takeaway");
  }

  if (text.includes("直播") || text.includes("短视频") || dataGB >= 260) {
    scenes.add("live-stream");
  }

  return Array.from(scenes);
}

export function deriveCities(text: string) {
  const cities = new Set<string>();
  const cityWords = [
    ["shenzhen", "深圳"],
    ["guangzhou", "广州"],
    ["dongguan", "东莞"]
  ] as const;

  for (const [slug, word] of cityWords) {
    if (text.includes(word)) {
      cities.add(slug);
    }
  }

  if (text.includes("广东") || text.includes("全国")) {
    cities.add("shenzhen");
    cities.add("guangzhou");
    cities.add("dongguan");
  }

  return Array.from(cities);
}
