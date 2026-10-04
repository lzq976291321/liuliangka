import type { ProductCategory } from "@/lib/types";

const broadbandWords = ["宽带", "单宽", "融合", "FTTR", "电视", "光猫"];
const mobileWords = ["流量", "通用", "定向", "手机卡", "电话卡", "月租", "选号", "通话"];

function numberFromMatch(match: RegExpMatchArray | null) {
  return match ? Number(match[1]) : undefined;
}

function monthlyAmounts(text: string, allowBundlePrice = false) {
  const consumerText = text.split(/([，,。；;\n])/).map((clause) => /(?:公域|私域|推广|宣传).*(?:不得超过|不得低于|不超过|不低于|禁止展示|禁止宣传)/.test(clause) ? "" : clause).join("");
  const patterns = [
    /(\d+(?:\.\d+)?)\s*元\s*(?:\/|每)?\s*(?:个)?月/g,
    /(\d+(?:\.\d+)?)\s*元\s*包月/g,
    /(?:月租|月费|月套餐费)\s*(?:为|是|[:：])?\s*(\d+(?:\.\d+)?)/g
  ];
  if (allowBundlePrice) {
    patterns.push(/(\d+(?:\.\d+)?)\s*元\s*\d+(?:\.\d+)?\s*G/gi);
  }
  return [...new Set(patterns.flatMap((pattern) => [...consumerText.matchAll(pattern)]
    .filter((match) => !/(?:月均|平均每月|折合每月|折算每月|每月平均|首充|充值|预存|预付)[^\d，,。；;]{0,6}$/.test(consumerText.slice(Math.max(0, (match.index ?? 0) - 16), match.index)))
    .map((match) => Number(match[1]))))];
}

function postPromoStart(text: string) {
  const explicit = text.match(/优惠(?:期)?(?:到期|结束|届满)(?:后)?|优惠期后|到期后|期满后|恢复(?:原价|月租|标准资费)/);
  const promotion = text.match(/首年|首月|前\s*\d+\s*(?:个月|月|年)|优惠期(?:内|期间)|前期/);
  const contextual = promotion ? text.slice((promotion.index ?? 0) + promotion[0].length).match(/之后|此后|随后|次年(?:起)?|第二年(?:起)?/) : null;
  const contextualIndex = contextual ? (promotion!.index ?? 0) + promotion![0].length + (contextual.index ?? 0) : undefined;
  const indexes = [explicit?.index, contextualIndex].filter((value): value is number => value !== undefined);
  return indexes.length ? Math.min(...indexes) : undefined;
}

export function parseMonthlyRent(text: string, fallback?: number) {
  // 到期资费不参与当前月租推断；多个当前价格不能悄悄采用第一个。
  const amounts = getMonthlyRentCandidates(text);
  return amounts.length === 1 ? amounts[0] : amounts.length ? undefined : fallback;
}

export function getMonthlyRentCandidates(text: string) {
  const postStart = postPromoStart(text);
  return monthlyAmounts(postStart === undefined ? text : text.slice(0, postStart), true);
}

export function parsePostPromoMonthlyRent(text: string): number | undefined {
  const start = postPromoStart(text);
  if (start === undefined) {
    return undefined;
  }
  const postPromoClause = text.slice(start).split(/[。；;\n]/, 1)[0];
  const amounts = monthlyAmounts(postPromoClause);
  return amounts.length === 1 ? amounts[0] : undefined;
}

export function parseData(text: string, fallback?: number) {
  const general =
    numberFromMatch(text.match(/(\d+(?:\.\d+)?)\s*GB?\s*(?:全国通用|通用|普通)(?:流量)?/i)) ??
    numberFromMatch(text.match(/(?:全国通用|通用|普通)(?:流量)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*GB?/i));
  const directed =
    numberFromMatch(text.match(/(\d+(?:\.\d+)?)\s*GB?\s*(?:定向|专属|权益)(?:流量)?/i)) ??
    numberFromMatch(text.match(/(?:定向|专属|权益)(?:流量)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*GB?/i));
  const explicitTotal =
    numberFromMatch(text.match(/(?:总流量|流量合计|流量总计|每月流量|包含流量)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*GB?/i)) ??
    numberFromMatch(text.match(/(?:合计|总共)\s*(\d+(?:\.\d+)?)\s*GB?/i));
  const unclassifiedData = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*GB?/gi))
    .filter((match) => {
      const before = text.slice(Math.max(0, (match.index ?? 0) - 8), match.index);
      const widerBefore = text.slice(Math.max(0, (match.index ?? 0) - 20), match.index);
      const after = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 8);
      if (/(?:通用|普通|定向|专属|权益)(?:流量)?\s*[:：]?\s*$/.test(before) || /^\s*(?:全国通用|通用|普通|定向|专属|权益)/.test(after)) {
        return false;
      }
      // 未说明按月发放的赠送总额不能覆盖套餐每月流量。
      if (/(?:额外)?(?:赠送|加赠|获赠|赠)(?:流量)?\s*$/.test(before) && !/每月|月赠|每个月/.test(widerBefore)) return false;
      // 裸 4G/5G 常指网络制式，不能据此生成流量额度。
      return ![4, 5].includes(Number(match[1])) || /^\s*流量/.test(after) || /流量\s*[:：]?\s*$/.test(before);
    })
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0 && value < 2000);
  const totalFromParts = general !== undefined && directed !== undefined ? general + directed : undefined;
  const total = explicitTotal ?? totalFromParts ?? (unclassifiedData.length ? Math.max(...unclassifiedData) : fallback);

  return {
    total,
    general,
    directed
  };
}

export function parseCallMinutes(text: string, fallback?: number) {
  return numberFromMatch(text.match(/(\d+(?:\.\d+)?)\s*分钟/)) ?? fallback;
}

export function parseFirstRechargeAmount(text: string) {
  // 明示首充合计后的括号分项是同一笔充值的说明，不能当作另一个总额。
  const normalized = text.replace(/((?:首充|首次充值)\s*\d+(?:\.\d+)?\s*元?)\s*【([^】]+)】/g, (whole, total, details) => /\+/.test(details) && !/可选|自愿|建议|任选|按需|非必须/.test(details) ? total : whole);
  return requiredPaymentAmount(normalized, /(?:首充|首次充值|激活(?:(?!返还|赠送|返赠|到账)[^\d，,。；;\n]){0,20}(?:充值|强充|充))\s*(?:话费|金额)?\s*(?:需要|需|须|为|是|[:：])?\s*(\d+(?:\.\d+)?)\s*元?(?!\s*(?:元|[\d.Gg/／、或至-]))/g);
}

function requiredPaymentAmount(text: string, pattern: RegExp) {
  const values = text.split(/[，,。；;\n]/).flatMap((clause) => {
    // 可选、每月重复充值和活动返还金额不是一次性必需支付。
    if (/可选|自愿|自主选择|按需|无需|不需|无需强制|非强制|非必须|任选|建议|可(?:以)?\s*(?:充值|充)|(?:每月|月月|按月)\s*(?:需要|需|须|必须)?\s*(?:充值|充|首充|预存|预付)/.test(clause)) {
      return [];
    }
    return [...clause.matchAll(pattern)].map((match) => Number(match[1]));
  });
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : undefined;
}

export function parseAverageMonthlyCost(text: string) {
  const amounts = [...new Set([...text.matchAll(/(?:月均|平均每月|折合每月|折算每月|每月平均)\s*(?:费用|资费|月租|成本)?\s*(?:为|是|[:：])?\s*(\d+(?:\.\d+)?)\s*元/g)].map((match) => Number(match[1])))];
  return amounts.length === 1 ? amounts[0] : undefined;
}

export function parsePrepaidAmount(text: string) {
  return requiredPaymentAmount(text, /(?:预付|预存|预缴)(?:费|款|话费|金额|费用)?\s*(?:为|是|[:：])?\s*(\d+(?:\.\d+)?)\s*元/g);
}

export function parseBillingPeriodMonths(text: string) {
  const periods: number[] = [];
  if (/(?<!半)年付|按年(?:支付|付费|缴费)|\d+(?:\.\d+)?\s*元\s*(?:\/\s*年|包年)/.test(text)) periods.push(12);
  if (/半年付|按半年(?:支付|付费|缴费)|\d+(?:\.\d+)?\s*元\s*\/\s*半年/.test(text)) periods.push(6);
  if (/季付|按季(?:度)?(?:支付|付费|缴费)|\d+(?:\.\d+)?\s*元\s*\/\s*季/.test(text)) periods.push(3);
  for (const match of text.matchAll(/(?:每)?(\d+)\s*个月(?:一付|支付一次|缴费一次)/g)) periods.push(Number(match[1]));
  const unique = [...new Set(periods.filter((period) => period > 0))];
  return unique.length === 1 ? unique[0] : undefined;
}

function parseOfferDuration(text: string) {
  const duration = text.match(/(?:优惠(?:期|期限|时间)?|资费(?:有效期|期限)|套餐(?:有效期|期限)|有效期|合约期|赠送期|前)\s*[:：为]?\s*(\d+|一|二|两|三|五|十|二十)\s*(个月|月|年)/)
    ?? text.trim().match(/^(\d+|一|二|两|三|五|十|二十)\s*(个月|月|年)$/);
  if (duration) {
    return `${duration[1]}${duration[2] === "月" ? "个月" : duration[2]}`;
  }
  return /首年/.test(text) ? "一年" : undefined;
}

export function parseIsLongTerm(text: string): boolean | undefined {
  if (/非长期|不(?:是|保证|承诺|属于)?长期|长期(?:待确认|不保证|不承诺|未确认)/.test(text)) {
    return /非长期|不是长期|不属于长期|不长期/.test(text) ? false : undefined;
  }
  const duration = parseOfferDuration(text);
  if (duration && !/^(?:20|二十)年$/.test(duration)) {
    return false;
  }
  if (/长期|永久/.test(text)) {
    return true;
  }
  if (/^(?:20|二十)年$/.test(duration ?? "")) {
    return true;
  }
  return duration || /短期|限时优惠/.test(text) ? false : undefined;
}

export function parsePriceTime(text: string, fallback = "待确认") {
  if (parseIsLongTerm(text)) {
    return "长期";
  }

  return parseOfferDuration(text) ?? fallback;
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
  monthlyRent?: number;
  dataGB?: number;
  callMinutes?: number;
  age1?: number;
  age2?: number;
  isLongTerm?: boolean;
}) {
  const scenes = new Set<string>();
  const { text, monthlyRent, dataGB, callMinutes, age1, age2, isLongTerm } = input;

  if (monthlyRent !== undefined && dataGB !== undefined && monthlyRent <= 29 && dataGB >= 100) {
    scenes.add("cheap");
  }

  if (isLongTerm) {
    scenes.add("long-term");
  }

  if (text.includes("学生") || text.includes("校园") || (monthlyRent !== undefined && age1 !== undefined && age2 !== undefined && monthlyRent <= 29 && age1 <= 18 && age2 <= 35)) {
    scenes.add("student");
  }

  if (text.includes("游戏") || text.includes("电竞") || (dataGB !== undefined && dataGB >= 220)) {
    scenes.add("gaming");
  }

  if (text.includes("外卖") || text.includes("骑手") || text.includes("跑腿") || (callMinutes !== undefined && callMinutes >= 100)) {
    scenes.add("takeaway");
  }

  if (text.includes("直播") || text.includes("短视频") || (dataGB !== undefined && dataGB >= 260)) {
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
