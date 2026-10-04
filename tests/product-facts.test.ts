import assert from "node:assert/strict";
import test from "node:test";
import { getValidatedProduct } from "../lib/product-facts";
import { enrichProduct } from "../lib/product-knowledge";
import { parseAverageMonthlyCost, parseBillingPeriodMonths, parseCallMinutes, parseData, parseFirstRechargeAmount, parseIsLongTerm, parseMonthlyRent, parsePostPromoMonthlyRent, parsePrepaidAmount, parsePriceTime } from "../lib/product-parser";
import type { CardProduct } from "../lib/types";
import type { Haoka172OrderLink } from "../lib/haoka172-order-links";

function product(changes: Partial<CardProduct> = {}): CardProduct {
  return {
    productID: 987654,
    productName: "测试套餐",
    mainPic: "",
    area: "全国",
    disableArea: [],
    flag: true,
    numberSel: 0,
    operator: "电信",
    backMoneyType: "",
    taocan: "",
    rule: "",
    priceTime: "待确认",
    skus: [],
    commission: 0,
    tags: [],
    scenes: [],
    cities: [],
    warnings: [],
    applyUrl: "",
    ...changes
  };
}

function order(changes: Partial<Haoka172OrderLink> = {}): Haoka172OrderLink {
  return { productID: 987654, productName: "测试套餐", shareUrl: "https://example.com/order", ...changes };
}

test("未知价格、流量、通话和年龄不会生成默认事实", () => {
  const result = getValidatedProduct(product(), order({ monthlyRent: "", generalDataGB: "  ", callMinutes: "" }));
  for (const field of ["monthlyRent", "dataGB", "generalDataGB", "directedDataGB", "callMinutes", "age1", "age2"] as const) {
    assert.equal(result[field], undefined, field);
  }
  assert.equal(parseMonthlyRent("待确认"), undefined);
  assert.equal(parseCallMinutes("待确认"), undefined);
  assert.equal(parseData("5G高速网络").total, undefined);
});

test("明确为零和小数的事实保持原值", () => {
  const result = getValidatedProduct(product(), order({ monthlyRent: "0", generalDataGB: "0", directedDataGB: "0", callMinutes: "0", age1: 0, age2: 65 }));
  assert.equal(result.monthlyRent, 0);
  assert.equal(result.generalDataGB, 0);
  assert.equal(result.dataGB, 0);
  assert.equal(result.callMinutes, 0);
  assert.equal(result.age1, 0);
  assert.equal(parseMonthlyRent("月租19.9元/月"), 19.9);
  assert.equal(parseCallMinutes("0分钟"), 0);
});

test("总流量和通用流量分别保存，单一分量不冒充总量", () => {
  const totalOnly = getValidatedProduct(product({ taocan: "总流量150G" }));
  assert.equal(totalOnly.dataGB, 150);
  assert.equal(totalOnly.generalDataGB, undefined);
  const generalOnly = getValidatedProduct(product({ taocan: "100G通用流量" }));
  assert.equal(generalOnly.generalDataGB, 100);
  assert.equal(generalOnly.dataGB, undefined);
  const parts = getValidatedProduct(product({ taocan: "通用流量100G，定向流量30G" }));
  assert.equal(parts.generalDataGB, 100);
  assert.equal(parts.directedDataGB, 30);
  assert.equal(parts.dataGB, 130);
});

test("优惠期限只采用明确描述，官方可查和按月收费不代表长期或短期", () => {
  for (const text of ["官方可查", "月租29元/月", "按月", "18岁成年可办理", "不保证长期"]) {
    assert.equal(parseIsLongTerm(text), undefined, text);
    assert.equal(parsePriceTime(text), "待确认", text);
  }
  assert.equal(parseIsLongTerm("长期29元"), true);
  assert.equal(parseIsLongTerm("优惠期12个月"), false);
  assert.equal(parsePriceTime("优惠期12个月"), "12个月");
  assert.equal(parsePriceTime("优惠期20年"), "长期");
  assert.equal(parsePriceTime("优惠期12个月，之后长期39元"), "12个月");
  assert.equal(getValidatedProduct(product({ rule: "官方可查" })).isLongTerm, undefined);
  assert.equal(getValidatedProduct(product({ priceTime: "两年", rule: "18岁可办" })).isLongTerm, false);
});

test("无效年龄和倒置区间标明待核对，不填回默认范围", () => {
  const invalid = getValidatedProduct(product({ age1: -1, age2: 160 }), order({ age1: 65, age2: 18 }));
  assert.equal(invalid.age1, undefined);
  assert.equal(invalid.age2, undefined);
  assert.ok(invalid.validationIssues?.some((issue) => issue.includes("年龄")));
  const reversed = getValidatedProduct(product({ age1: 60, age2: 18 }));
  assert.equal(reversed.age1, undefined);
  assert.equal(reversed.age2, undefined);
});

test("月租双源冲突保持未知，不采用任何一侧价格参与筛选", () => {
  const result = getValidatedProduct(
    product({ monthlyRent: 29, age1: 18, age2: 60, updatedAt: "2026-10-02T01:00:00.000Z" }),
    order({ monthlyRent: "39", age1: 20, age2: 60, updatedAt: "2026-10-03T01:00:00.000Z" })
  );
  assert.equal(result.monthlyRent, undefined);
  assert.equal(result.age1, 20);
  assert.ok(result.validationIssues?.some((issue) => issue.includes("月租冲突") && issue.includes("29") && issue.includes("39")));
  assert.match(result.factSources?.monthlyRent ?? "", /待核对/);
  assert.equal(enrichProduct(result).monthlyRent, undefined);
  assert.equal(result.updatedAt, "2026-10-02T01:00:00.000Z");
});

test("2586月均20与首充240不能把办理接口240当作月租", () => {
  const result = getValidatedProduct(product({ productID: 2586, productName: "上海广电专属卡【月均20元350G+200分钟】", taocan: "月均20元350G+200分钟", rule: "激活当月一次性首充240元" }), order({ productID: 2586, monthlyRent: "240" }));
  assert.equal(result.averageMonthlyCost, 20);
  assert.equal(result.firstRechargeAmount, 240);
  assert.equal(result.monthlyRent, undefined);
  assert.equal(result.prepaidAmount, undefined);
  assert.equal(result.billingPeriodMonths, undefined);
  assert.ok(result.validationIssues?.some((issue) => issue.startsWith("月租金额含义待核对")));
  assert.equal(getValidatedProduct(result, order({ productID: 2586, monthlyRent: "240" })).monthlyRent, undefined);
});

test("月均、预存、计费周期单独解析，不由价格比值推断", () => {
  assert.equal(parseAverageMonthlyCost("折合每月19.5元"), 19.5);
  assert.equal(parseMonthlyRent("月均20元350G"), undefined);
  assert.equal(parsePrepaidAmount("需预存240元"), 240);
  assert.equal(parsePrepaidAmount("可选预存240元"), undefined);
  assert.equal(parseBillingPeriodMonths("240元/年"), 12);
  assert.equal(parseBillingPeriodMonths("半年付"), 6);
  assert.equal(parseBillingPeriodMonths("月均20元，首充240元"), undefined);
  assert.equal(parseMonthlyRent("月租29元，预存240元"), 29);
});

test("首充只提取明确的一次性必需充值", () => {
  assert.equal(parseFirstRechargeAmount("激活后需充值100元"), 100);
  assert.equal(parseFirstRechargeAmount("首次充值50元"), 50);
  assert.equal(parseFirstRechargeAmount("首充100"), 100);
  assert.equal(parseFirstRechargeAmount("可选首充100元"), undefined);
  assert.equal(parseFirstRechargeAmount("每月充值100元"), undefined);
  assert.equal(parseFirstRechargeAmount("无需首充100元"), undefined);
  assert.equal(parseFirstRechargeAmount("每月充值50元；激活需充值100元"), 100);
  assert.equal(parseFirstRechargeAmount("激活过程中充值100元"), 100);
  assert.equal(parseFirstRechargeAmount("激活派件员处充值100元"), 100);
  assert.equal(parseFirstRechargeAmount("激活当月专属渠道充值100元"), 100);
  assert.equal(parseFirstRechargeAmount("激活时在业务员处一次性充值100元"), 100);
  assert.equal(parseFirstRechargeAmount("激活过程中充200元"), 200);
  assert.equal(parseFirstRechargeAmount("激活强充200元"), 200);
  assert.equal(parseFirstRechargeAmount("激活当月任意渠道充值100/200元"), undefined);
  assert.equal(parseFirstRechargeAmount("激活后可选充值100元"), undefined);
  assert.equal(parseFirstRechargeAmount("激活后每月充值100元"), undefined);
  assert.equal(parseFirstRechargeAmount("激活后返还充值100元"), undefined);
  assert.equal(parseFirstRechargeAmount("激活首充110【派件员处参加充值合约60元+激活当日任意渠道充50元】"), 110);
  assert.equal(parseFirstRechargeAmount("首充100元，激活需充值200元"), undefined);
});

test("4011的宣传限价不是消费者月租，真实39与29套餐冲突仍保留", () => {
  const result = getValidatedProduct(product({ productID: 4011, productName: "广西专享广电卡【29元192G】", taocan: "仅限私域推广，公域推广不得超过39元60G，29元192G，仅发广西", rule: "激活后务必在快递处首充100享受优惠" }), order({ productID: 4011, monthlyRent: "29" }));
  assert.equal(result.monthlyRent, 29);
  assert.ok(!result.validationIssues?.some((issue) => issue.startsWith("月租")));
  const realConflict = getValidatedProduct(product({ productName: "陕西专属卡39元60G", taocan: "9.2日起实际为29元200G" }), order({ monthlyRent: "39" }));
  assert.equal(realConflict.monthlyRent, undefined);
});

test("4135包年与预存单独保留，4178赠送额度不冒充每月流量", () => {
  const annual = getValidatedProduct(product({ productID: 4135, productName: "联通360元包年卡【每月315G+300分钟】", taocan: "360元包年享315G流量+300分钟", rule: "下单预存360元" }), order({ productID: 4135, monthlyRent: "360" }));
  assert.equal(annual.billingPeriodMonths, 12);
  assert.equal(annual.prepaidAmount, 360);
  assert.equal(annual.monthlyRent, undefined);
  const gift = getValidatedProduct(product({ productID: 4178, productName: "联通飞辰卡【39元155G+100分钟】", taocan: "39元155G+100分钟，三照发全国，额外赠送360G" }), order({ productID: 4178, monthlyRent: "39", generalDataGB: "155", directedDataGB: "0" }));
  assert.equal(gift.dataGB, 155);
  assert.ok(!gift.validationIssues?.some((issue) => issue.startsWith("总流量冲突")));
});

test("资料超过30分钟可识别过期，未核实旧事实不刷新时间", () => {
  const recent = new Date(Date.now() - 5 * 60_000).toISOString();
  const old = new Date(Date.now() - 31 * 60_000).toISOString();
  assert.equal(getValidatedProduct(product({ updatedAt: recent })).dataFreshness, "fresh");
  const result = getValidatedProduct(product({ updatedAt: old }), order({ monthlyRent: "19", updatedAt: recent }));
  assert.equal(result.updatedAt, old);
  assert.equal(result.dataFreshness, "stale");
  assert.equal(getValidatedProduct(product()).dataFreshness, "unknown");
});

test("空办理字段保留已知商品值，错商品和非法值不能覆盖事实", () => {
  const known = product({ monthlyRent: 19, callMinutes: 100 });
  const empty = getValidatedProduct(known, order({ monthlyRent: "", callMinutes: "待确认" }));
  assert.equal(empty.monthlyRent, 19);
  assert.equal(empty.callMinutes, 100);
  assert.ok(empty.validationIssues?.some((issue) => issue.includes("通话分钟无效")));
  const mismatch = getValidatedProduct(known, order({ productID: 12, monthlyRent: "99" }));
  assert.equal(mismatch.monthlyRent, 19);
  assert.ok(mismatch.validationIssues?.some((issue) => issue.includes("商品不一致")));
});

test("消费者禁办限制和清洗前原文保留，人工隐藏状态继续生效", () => {
  const result = enrichProduct(product({ productID: 1906, rule: "佣金结算后到账；禁止深圳地区办理；年龄18至60岁", taocan: "仅限广东激活" }));
  assert.match(result.rule, /禁止深圳地区办理/);
  assert.match(result.eligibilityText ?? "", /禁止深圳地区办理/);
  assert.match(result.eligibilityText ?? "", /仅限广东激活/);
  assert.equal(result.status, "hidden");
});

test("期后月租只取明确阶段与每月资费，不从第二个金额猜测", () => {
  assert.equal(parsePostPromoMonthlyRent("月租29元，首充100元"), undefined);
  assert.equal(parsePostPromoMonthlyRent("首年29元100G，之后39元/月"), 39);
  assert.equal(parsePostPromoMonthlyRent("优惠到期后恢复原价59元/月"), 59);
  assert.equal(parsePostPromoMonthlyRent("优惠结束后月租39元"), 39);
  assert.equal(parsePostPromoMonthlyRent("恢复原价199元/年"), undefined);
  assert.equal(parsePostPromoMonthlyRent("优惠到期后以运营商政策为准"), undefined);
  assert.equal(parsePostPromoMonthlyRent("优惠结束后39元/月或59元/月"), undefined);
});

test("当前月租与期后月租分别解析、校验并记录来源", () => {
  assert.equal(parseMonthlyRent("首年29元100G，之后39元/月"), 29);
  assert.equal(parseMonthlyRent("优惠结束后39元/月"), undefined);
  assert.equal(parseMonthlyRent("29元/月或39元/月"), undefined);
  const result = getValidatedProduct(product({ taocan: "首年29元100G，之后39元/月", updatedAt: "2026-10-03T01:00:00.000Z" }));
  assert.equal(result.monthlyRent, 29);
  assert.equal(result.postPromoMonthlyRent, 39);
  assert.match(result.factSources?.postPromoMonthlyRent ?? "", /套餐文本.*2026-10-03/);
  assert.equal(getValidatedProduct(product()).postPromoMonthlyRent, undefined);
  const invalid = getValidatedProduct(product({ postPromoMonthlyRent: -1 }));
  assert.equal(invalid.postPromoMonthlyRent, undefined);
  assert.ok(invalid.validationIssues?.some((issue) => issue.includes("优惠结束后月租无效")));
});
