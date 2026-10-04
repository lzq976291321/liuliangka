import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEligibility } from "../lib/product-eligibility";
import { rankProducts, scoreProduct } from "../lib/recommendation";
import type { CardProduct } from "../lib/types";

function product(changes: Partial<CardProduct> = {}): CardProduct {
  return {
    productID: 1, productName: "测试套餐", mainPic: "", area: "广东", disableArea: [], flag: true,
    numberSel: 0, operator: "电信", backMoneyType: "", taocan: "", rule: "", age1: 18, age2: 60,
    priceTime: "", skus: [], monthlyRent: 29, dataGB: 150, generalDataGB: 100, callMinutes: 100,
    commission: 0, tags: [], scenes: [], cities: ["shenzhen"], warnings: [], applyUrl: "", ...changes
  };
}

test("全国发货不能覆盖整省禁发", () => {
  const card = product({ rule: "全国发货", disableArea: ["广东省"] });
  const result = evaluateEligibility(card, { province: "广东", city: "深圳市", age: 25 });
  assert.equal(result.status, "ineligible");
  assert.match(result.reasons.join(""), /禁发/);
});

test("识别省市后缀、城市单独禁发和旧城市 slug", () => {
  for (const region of ["广东省深圳市", "广东深圳市", "深圳市", "深圳"]) {
    assert.equal(evaluateEligibility(product({ rule: "全国发货", disableArea: [region] }), { city: "shenzhen" }).status, "ineligible", region);
    assert.equal(evaluateEligibility(product({ rule: "全国发货", disableArea: [region] }), { province: "广东省", city: "广州市" }).status, "eligible", region);
  }
});

test("只选省时，市级或区级禁发只能待确认", () => {
  const card = product({ rule: "全国发货", disableArea: ["广东省深圳市"] });
  assert.equal(evaluateEligibility(card, { province: "广东" }).status, "unknown");
  assert.equal(evaluateEligibility(card, { province: "湖南" }).status, "eligible");
  assert.equal(evaluateEligibility(product({ rule: "全国发货", disableArea: ["广东省深圳市南山区"] }), { province: "广东", city: "深圳" }).status, "unknown");
});

test("号码归属地、派生城市标签和全国通用流量都不能作为可办证明", () => {
  const card = product({ area: "全国", taocan: "广东归属地，150G全国通用流量" });
  assert.equal(evaluateEligibility(card, { province: "广东", city: "深圳" }).status, "unknown");
  assert.equal(evaluateEligibility(card, {}).status, "unknown");
  assert.ok(!scoreProduct(card, { city: "shenzhen" }).reasons.some((reason) => /地区.*可办|地区.*符合/.test(reason)));
});

test("缺失年龄范围不默认成年范围，明确年龄不符为硬排除", () => {
  assert.equal(evaluateEligibility(product({ age1: undefined, age2: undefined }), { age: 25 }).status, "unknown");
  assert.equal(evaluateEligibility(product({ age2: undefined }), { age: 25 }).status, "unknown");
  assert.equal(evaluateEligibility(product(), { age: 17 }).status, "ineligible");
  assert.equal(evaluateEligibility(product(), { age: 61 }).status, "ineligible");
  assert.equal(evaluateEligibility(product(), { age: 18 }).status, "eligible");
  assert.equal(evaluateEligibility(product(), { age: 60 }).status, "eligible");
});

test("明确仅发省份：匹配可确认，不匹配应排除", () => {
  const card = product({ rule: "18-60周岁下单，仅发湖南，江西" });
  assert.equal(evaluateEligibility(card, { province: "湖南", age: 25 }).status, "eligible");
  assert.equal(evaluateEligibility(card, { province: "江西", age: 25 }).status, "eligible");
  assert.equal(evaluateEligibility(card, { province: "广东", age: 25 }).status, "ineligible");
});

test("明确限定地区办理可作为收货条件，单纯号码归属地不能", () => {
  const card = product({ rule: "仅限广东省内办理" });
  assert.equal(evaluateEligibility(card, { province: "广东" }).status, "eligible");
  assert.equal(evaluateEligibility(card, { province: "湖南" }).status, "ineligible");
  assert.equal(evaluateEligibility(product({ rule: "仅限广东号码归属地" }), { province: "广东" }).status, "unknown");
});

test("仅发城市不能推成全省可办", () => {
  const card = product({ rule: "仅发广州市，首充100元" });
  assert.equal(evaluateEligibility(card, { province: "广东" }).status, "unknown");
  assert.equal(evaluateEligibility(card, { province: "广东", city: "广州" }).status, "eligible");
  assert.equal(evaluateEligibility(card, { province: "广东", city: "深圳" }).status, "ineligible");
});

test("负向文本不会因出现目标省份而变成正向推荐", () => {
  for (const rule of ["全国发货，广东不发", "全国发货；禁发地区：广东、广西", "全国发货；广东、广西禁止发货", "全国发货；深圳市禁发"]) {
    const result = evaluateEligibility(product({ rule }), { province: "广东", city: "深圳" });
    assert.equal(result.status, "ineligible", rule);
    assert.ok(!result.reasons.some((reason) => /符合/.test(reason)), rule);
  }
});

test("全国通用、非全国发货和未知复杂限制不产生已确认可办", () => {
  for (const rule of ["全国通用", "非全国发货", "不支持全国发货", "全国发货；部分地区不发", "全国发货；仅发广东（深圳除外）", "全国发货，广东除外", "全国发货，广东不发，深圳除外"]) {
    assert.equal(evaluateEligibility(product({ rule }), { province: "广东", city: "深圳" }).status, "unknown", rule);
  }
});

test("保留原始条款和 SKU 中的限制", () => {
  assert.equal(evaluateEligibility(product({ rule: "", eligibilityText: "全国发货；广东不发" }), { city: "shenzhen" }).status, "ineligible");
  assert.equal(evaluateEligibility(product({ skus: [{ id: 1, name: "套餐", description: "仅发浙江" }] }), { province: "广东" }).status, "ineligible");
});

test("冲突字段阻止确定匹配，明确不符仍然排除", () => {
  const card = product({ rule: "全国发货", validationIssues: ["年龄范围冲突"] });
  assert.equal(evaluateEligibility(card, { province: "广东", age: 25 }).status, "unknown");
  assert.equal(evaluateEligibility(card, { province: "广东", age: 15 }).status, "ineligible");
  assert.equal(evaluateEligibility(product({ rule: "仅发广东；仅发浙江" }), { province: "广东" }).status, "unknown");
  assert.equal(evaluateEligibility(product({ rule: "全国发货" }), { province: "湖南", city: "深圳" }).status, "unknown");
});

test("无法识别或与省份不一致的城市不因全国发货而得到可办结论", () => {
  for (const rule of ["全国发货", "仅发广东"]) {
    for (const city of ["不存在城市", "杭州市", "深圳乱填", "广东市"]) {
      assert.equal(evaluateEligibility(product({ rule }), { province: "广东", city }).status, "unknown", `${rule}: ${city}`);
    }
  }
});

test("推荐排除年龄和地区不符，输入条件后待确认商品也不能称匹配", () => {
  const cards = [
    product({ productID: 1, rule: "全国发货", age1: 30 }),
    product({ productID: 2, rule: "仅发浙江" }),
    product({ productID: 3, rule: "" }),
    product({ productID: 4, rule: "全国发货" })
  ];
  assert.deepEqual(rankProducts(cards, { province: "广东", city: "深圳", age: 25 }).map(({ product }) => product.productID), [4]);
  assert.equal(rankProducts(cards).length, 4);
});

test("推荐只按真实预算和通用流量加分，不把总流量当通用", () => {
  const card = product({ dataGB: 200, generalDataGB: 20, monthlyRent: undefined });
  const result = scoreProduct(card, { budget: 39, dataNeedGB: 100 });
  assert.ok(!result.reasons.some((reason) => /预算内|流量.*达到|流量.*充足/.test(reason)));
  assert.ok(!scoreProduct(product()).reasons.some((reason) => /预算/.test(reason)));
  assert.ok(scoreProduct(product(), { budget: 29, dataNeedGB: 100 }).reasons.includes("通用流量达到所需用量"));
});


test("官方可查本身不证明长期优惠，推荐沿用已确认长期字段", () => {
  assert.ok(!scoreProduct(product({ priceTime: "官方可查" })).reasons.includes("标注长期优惠"));
  assert.ok(scoreProduct(product({ priceTime: "20年", isLongTerm: true })).reasons.includes("标注长期优惠"));
});

test("全部收录城市都能核对全国发货，含自治州、盟和省直辖县级单位", async () => {
  const { provinceRegions } = await import("../lib/china-regions");
  const card = product({ rule: "全国发货" });
  for (const province of provinceRegions) {
    for (const city of province.cities) {
      assert.equal(evaluateEligibility(card, { province: province.value, city: city.name }).status, "eligible", `${province.name}/${city.name}`);
    }
  }
});

test("同名省市及自治州不会扩大禁发范围", () => {
  assert.equal(evaluateEligibility(product({ rule: "全国发货", disableArea: ["吉林市"] }), { province: "吉林", city: "长春市" }).status, "eligible");
  assert.equal(evaluateEligibility(product({ rule: "全国发货", disableArea: ["吉林市"] }), { province: "吉林", city: "吉林市" }).status, "ineligible");
  assert.equal(evaluateEligibility(product({ rule: "全国发货", disableArea: ["海南藏族自治州"] }), { province: "海南", city: "海口市" }).status, "eligible");
  assert.equal(evaluateEligibility(product({ rule: "全国发货", disableArea: ["海南藏族自治州"] }), { province: "青海", city: "海南藏族自治州" }).status, "ineligible");
});

test("直辖市和省直辖县级单位禁发可核对，未知旧城市仍待确认", () => {
  for (const [province, city] of [["北京", "北京市"], ["河南", "济源市"], ["湖北", "神农架林区"], ["海南", "澄迈县"], ["新疆", "白杨市"]]) {
    const card = product({ rule: "全国发货", disableArea: [city] });
    assert.equal(evaluateEligibility(card, { province, city }).status, "ineligible", `${province}/${city}`);
  }
  assert.equal(evaluateEligibility(product({ rule: "全国发货" }), { province: "广东", city: "旧城市名字" }).status, "unknown");
  assert.equal(evaluateEligibility(product({ rule: "全国发货", disableArea: ["海南州"] }), { province: "海南", city: "海口市" }).status, "unknown");
});
