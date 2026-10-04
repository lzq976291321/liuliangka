import type { CardProduct } from "@/lib/types";

import { cityRegionAliases, findCityRegion, findProvinceRegion, provinceOptions } from "@/lib/china-regions";
export { provinceOptions } from "@/lib/china-regions";

export type EligibilityContext = { province?: string; city?: string; age?: number };
export type EligibilityResult = { status: "eligible" | "ineligible" | "unknown"; reasons: string[] };
type EligibilityProduct = Pick<CardProduct, "age1" | "age2" | "disableArea" | "area" | "rule" | "taocan" | "skus"> & {
  eligibilityText?: string;
  validationIssues?: string[];
};
type Region = { province?: string; city?: string; partial?: boolean; unrecognized?: boolean; label: string };

const cityProvinces = Object.fromEntries(cityRegionAliases.map((region) => [region.city, region.province]));
const provinceNames = [...provinceOptions].sort((a, b) => b.length - a.length);
const municipalities = new Set(["北京", "天津", "上海", "重庆"]);
const autonomousSuffix = /^(?:维吾尔自治区|壮族自治区|回族自治区|自治区|省|市)/;

function plainText(value: string) {
  return value.replace(/<br\s*\/?\s*>|<\/p>/gi, "；").replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|amp);/g, " ").trim();
}

/** Read only an explicit geographic prefix; the remaining prose is never a region. */
function readRegion(value: string): { region: Region; rest: string } | undefined {
  let rest = value.trim();
  const original = rest;
  // "吉林市" and "海南藏族自治州" are cities, not province-wide restrictions.
  const explicitCity = cityRegionAliases.find((region) => region.alias === region.city && rest.startsWith(region.alias) && !municipalities.has(region.province));
  const province = explicitCity ? undefined : provinceNames.find((name) => rest.startsWith(name));
  if (province) rest = rest.slice(province.length).replace(autonomousSuffix, "");
  const knownCity = cityRegionAliases.find((region) => rest.startsWith(region.alias) && (!province || region.province === province));
  let city = knownCity?.city;
  let unrecognized = false;
  if (knownCity) {
    rest = rest.slice(knownCity.alias.length);
  } else if (!province || !municipalities.has(province)) {
    // Preserve unfamiliar explicit city names as uncertain restrictions, never as a mismatch.
    const match = rest.match(/^([\u4e00-\u9fff]{2,12}?)(?:自治州|地区|市|盟)/);
    if (match && !/发|办|货|限|归属|全国|部分|指定|注意|流量/.test(match[1])) {
      city = match[1];
      unrecognized = true;
      rest = rest.slice(match[0].length);
    }
  }
  if (!province && !city) return undefined;
  let partial = false;
  const detail = rest.match(/^(?:[\u4e00-\u9fff]{1,12}?(?:区|县|镇|街道)|部分(?:地区|区域|城市)?|个别(?:地区|区域|城市)?|指定(?:地区|区域|城市)?)/);
  if (detail && !/发|办|货|归属|通用/.test(detail[0])) {
    partial = true;
    rest = rest.slice(detail[0].length);
  }
  rest = rest.replace(/^(?:全省|省内|全市|市内|地区|内(?=办理|发货|收货|配送))/, "");
  return { region: { province: province ?? (city ? cityProvinces[city] : undefined), city, partial, unrecognized, label: original.slice(0, original.length - rest.length) }, rest };
}

function readRegionList(value: string) {
  let rest = value.trim().replace(/^[:：]/, "");
  const regions: Region[] = [];
  while (rest) {
    const parsed = readRegion(rest);
    if (!parsed) break;
    regions.push(parsed.region);
    rest = parsed.rest;
    const separator = rest.match(/^[,，、/\s及与和]+/);
    if (!separator) break;
    const next = rest.slice(separator[0].length);
    if (!readRegion(next)) break;
    rest = next;
  }
  return { regions, rest: rest.trim() };
}

function normalizeContext(context: EligibilityContext) {
  const province = findProvinceRegion(context.province)?.value;
  const cityRegion = findCityRegion(context.city);
  const city = cityRegion?.city;
  const cityProvince = cityRegion?.province;
  const invalid = Boolean(
    (context.province?.trim() && !province) ||
    (context.city?.trim() && !cityRegion) ||
    (province && cityProvince && province !== cityProvince)
  );
  return { province: province ?? cityProvince, city, invalid };
}

type RegionRelation = "match" | "miss" | "partial" | "unknown";
function relation(region: Region, target: ReturnType<typeof normalizeContext>): RegionRelation {
  if (region.province && target.province && region.province !== target.province) return "miss";
  if (region.city) {
    if (region.unrecognized) return "unknown";
    if (!target.city) return region.province && target.province === region.province ? "partial" : "unknown";
    if (region.city !== target.city) return "miss";
    return region.partial ? "partial" : "match";
  }
  if (!target.province) return "unknown";
  return region.partial ? "partial" : "match";
}

function shippingRules(product: EligibilityProduct) {
  // `area` describes the phone number's home region, not the delivery destination.
  const text = Array.from(new Set([
    product.eligibilityText ?? "", product.rule, product.taocan,
    ...product.skus.map((sku) => `${sku.name} ${sku.description}`)
  ].map(plainText).filter(Boolean))).join("；");
  const denied: Region[] = [];
  const allowedGroups: Region[][] = [];
  let ambiguous = false;
  for (const entry of product.disableArea) {
    if (/^(?:无|暂无|无禁发地区|不限|全国可发)$/.test(entry.trim())) continue;
    const parsed = readRegionList(plainText(entry));
    if (!parsed.regions.length || /[^,，、。；;\s]/.test(parsed.rest)) {
      ambiguous = true;
      // A trailing unparsed qualifier may narrow the final region (e.g. a district/exception).
      if (parsed.regions.length) parsed.regions[parsed.regions.length - 1].partial = true;
    }
    denied.push(...parsed.regions);
  }

  for (const clause of text.split(/[。；;\n]/).filter(Boolean)) {
    // Exception prose can reverse a preceding rule; retain it for manual confirmation.
    if (/除外|除[^。；;]{0,50}外|不含|不包含/.test(clause) && /发|配送|办理|收货/.test(clause)) {
      ambiguous = true;
      continue;
    }
    for (const match of clause.matchAll(/(?:仅限|只限|仅支持)\s*[:：]?/g)) {
      const parsed = readRegionList(clause.slice(match.index! + match[0].length));
      if (parsed.regions.length && /^(?:地区)?(?:办理|发货|收货|配送)/.test(parsed.rest)) {
        allowedGroups.push(parsed.regions);
      }
    }
    for (const match of clause.matchAll(/(?:仅限发货|仅限发|仅发货|仅发|只发货|只发|仅配送|只配送|限发)(?:地区)?\s*[:：]?/g)) {
      const parsed = readRegionList(clause.slice(match.index! + match[0].length));
      if (parsed.regions.length) allowedGroups.push(parsed.regions);
      if (!parsed.regions.length || /^[（(]|部分|个别|指定|除外|除.*外/.test(parsed.rest)) ambiguous = true;
    }
    for (const match of clause.matchAll(/(?:禁止发货|禁止配送|不支持发货|不支持配送|不支持办理|禁发|不发货|不发|禁运)(?:地区|区域)?\s*[:：]?/g)) {
      const before = clause.slice(0, match.index).trim();
      const after = clause.slice(match.index! + match[0].length).trim();
      // Prefix form: "禁发地区：广东、广西". Suffix form: "广东、广西不发".
      let regions = readRegionList(after).regions;
      if (!regions.length) {
        for (let start = 0; start < before.length; start++) {
          const parsed = readRegionList(before.slice(start));
          if (parsed.regions.length && /^[,，、\s]*$/.test(parsed.rest)) {
            regions = parsed.regions;
            break;
          }
        }
      }
      if (regions.length) denied.push(...regions);
      else ambiguous = true;
    }
    if (/(?:发货|配送|收货|禁发|不发|仅发).{0,12}(?:部分地区|部分区域|指定地区|以.*为准)|(?:部分地区|部分区域).{0,8}(?:发货|禁发|不发)/.test(clause)) ambiguous = true;
  }
  const nationwide = [...text.matchAll(/全国(?:均可|都可|可)?(?:发货|配送|办理|可办|可发)/g)]
    .some((match) => !/(?:不|非|禁止|不支持).{0,3}$/.test(text.slice(Math.max(0, match.index! - 8), match.index)));
  return { denied, allowedGroups, ambiguous, nationwide };
}

export function evaluateEligibility(product: EligibilityProduct, context: EligibilityContext = {}): EligibilityResult {
  const hasLocation = Boolean(context.province?.trim() || context.city?.trim());
  const hasAge = context.age !== undefined;
  if (!hasLocation && !hasAge) return { status: "unknown", reasons: ["填写收货地区或年龄后可核对办理条件"] };

  const failures: string[] = [];
  const unknowns: string[] = [];
  const matches: string[] = [];
  if (hasAge) {
    const minimum = product.age1;
    const maximum = product.age2;
    const validMin = typeof minimum === "number" && Number.isFinite(minimum) && minimum >= 0;
    const validMax = typeof maximum === "number" && Number.isFinite(maximum) && maximum > 0;
    if (!Number.isInteger(context.age) || context.age! < 0 || context.age! > 120) {
      unknowns.push("请填写有效年龄");
    } else if (validMin && validMax && minimum > maximum) {
      unknowns.push("套餐年龄范围有冲突，需确认");
    } else if ((validMin && context.age! < minimum) || (validMax && context.age! > maximum)) {
      const range = validMin && validMax ? `${minimum}–${maximum} 岁` : validMin ? `${minimum} 岁及以上` : `${maximum} 岁及以下`;
      failures.push(`年龄不符合套餐要求（${range}）`);
    } else if (!validMin || !validMax) {
      unknowns.push("套餐年龄范围尚未确认");
    } else {
      matches.push(`年龄符合 ${minimum}–${maximum} 岁要求`);
    }
  }

  if (hasLocation) {
    const target = normalizeContext(context);
    if (target.invalid) {
      unknowns.push("收货省份与城市需核对");
    } else {
      const rules = shippingRules(product);
      const prohibited = rules.denied.filter((region) => relation(region, target) === "match");
      if (prohibited.length) {
        failures.push(`收货地区在禁发范围内（${prohibited[0].label}）`);
      } else {
        const unresolvedBan = rules.denied.some((region) => ["partial", "unknown"].includes(relation(region, target)));
        const groupMatches = rules.allowedGroups.map((group) => group.map((region) => relation(region, target)));
        const allowMatches = groupMatches.map((group) => group.includes("match"));
        if (groupMatches.length && groupMatches.every((group) => group.every((value) => value === "miss")) && !rules.ambiguous) {
          failures.push(`套餐仅发${Array.from(new Set(rules.allowedGroups.flat().map((region) => region.label))).join("、")}`);
        } else if (unresolvedBan) {
          unknowns.push("存在部分地区禁发限制，需核对具体收货城市或地址");
        } else if (rules.ambiguous || (allowMatches.some(Boolean) && !allowMatches.every(Boolean))) {
          unknowns.push("发货条款存在未确认或冲突的限制");
        } else if (groupMatches.length && !allowMatches.every(Boolean)) {
          unknowns.push("套餐仅发指定地区，需核对具体收货城市或地址");
        } else if (allowMatches.length || rules.nationwide) {
          matches.push("收货地区符合已注明的发货范围");
        } else {
          unknowns.push("收货地区是否可办尚未确认");
        }
      }
    }
  }

  if (product.validationIssues?.length) unknowns.push("套餐信息存在待核对项");
  if (failures.length) return { status: "ineligible", reasons: failures };
  if (unknowns.length) return { status: "unknown", reasons: Array.from(new Set([...unknowns, ...matches])) };
  return { status: "eligible", reasons: matches };
}
