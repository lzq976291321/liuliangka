import assert from "node:assert/strict";
import test from "node:test";
import { provinceRegions, getCityOptions, findCityRegion, regionDataSource } from "../lib/china-regions";
import { emptyRequirements, normalizeCustomerRequirements, parseStoredRequirements, requirementsHref, restoreCustomerRequirements, toEligibilityContext } from "../components/EligibilityControls";

const saved = JSON.stringify({ province: "广东", city: "深圳市", age: "25", keyword: "不应恢复", token: "不应保存" });

test("省市数据有固定来源与完整范围，特殊地区不以汇总占位代替", () => {
  assert.equal(provinceRegions.length, 31);
  assert.equal(provinceRegions.reduce((sum, province) => sum + province.cities.length, 0), 369);
  assert.equal(regionDataSource.commit, "dc3a1d7acd85ca1b0979543e9259604142c52e8e");
  assert.equal(regionDataSource.snapshotDate, "2023-06-30");
  const codes = provinceRegions.flatMap((province) => province.cities.map((city) => city.code));
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(provinceRegions.every((province) => province.cities.length && province.cities.every((city) => !/市辖区|直辖县级行政区划/.test(city.name))));
  assert.deepEqual(getCityOptions("重庆").map((city) => city.name), ["重庆市"]);
  for (const [province, city] of [["河南", "济源市"], ["湖北", "神农架林区"], ["海南", "澄迈县"], ["新疆", "白杨市"], ["内蒙古", "锡林郭勒盟"], ["云南", "大理白族自治州"]]) {
    assert.ok(getCityOptions(province).some((option) => option.name === city), `${province}/${city}`);
  }
});

test("已知旧链接名称规范化，未知或错配的地区保留待确认", () => {
  assert.deepEqual(normalizeCustomerRequirements({ province: "广东省", city: "shenzhen", age: "25" }), { province: "广东", city: "深圳市", age: "25" });
  assert.deepEqual(normalizeCustomerRequirements({ province: "", city: "广州市", age: "" }), { province: "广东", city: "广州市", age: "" });
  assert.equal(findCityRegion("广东省深圳市")?.city, "深圳市");
  assert.equal(findCityRegion("不存在城市"), undefined);
  assert.equal(findCityRegion("杭州市", "广东"), undefined);
  assert.equal(normalizeCustomerRequirements({ province: "广东", city: "旧城市名字", age: "" }).city, "旧城市名字");
});

test("URL任一显式条件优先于整个会话快照，不能夹带上一次年龄和地区", () => {
  assert.deepEqual(restoreCustomerRequirements("?age=17&operator=移动", saved), { source: "url", requirements: { province: "", city: "", age: "17" } });
  assert.deepEqual(restoreCustomerRequirements("?province=湖南", saved).requirements, { province: "湖南", city: "", age: "" });
  assert.deepEqual(restoreCustomerRequirements("?province=&city=&age=", saved), { source: "url", requirements: emptyRequirements });
});

test("无URL条件时恢复本标签会话，清空后不会带回之前的条件", () => {
  assert.deepEqual(restoreCustomerRequirements("?channel=sample", saved), { source: "session", requirements: { province: "广东", city: "深圳市", age: "25" } });
  assert.deepEqual(restoreCustomerRequirements("", JSON.stringify(emptyRequirements)), { source: "session", requirements: emptyRequirements });
  assert.deepEqual(restoreCustomerRequirements("", null), { source: "empty", requirements: emptyRequirements });
});

test("存储只读取三个字符串字段，损坏或不合法形状不能覆盖当前URL", () => {
  assert.deepEqual(parseStoredRequirements(saved), { province: "广东", city: "深圳市", age: "25" });
  for (const value of ["{", "[]", "null", JSON.stringify({ province: "广东", city: "深圳", age: 25 })]) assert.equal(parseStoredRequirements(value), undefined);
  assert.equal(restoreCustomerRequirements("?age=abc", "{").requirements.age, "abc");
  assert.ok(Number.isNaN(toEligibilityContext(restoreCustomerRequirements("?age=abc", saved).requirements).age));
});

test("更新及清空条件保留其他筛选、归因参数和页面锚点", () => {
  const href = requirementsHref("/card/1?keyword=电信&operator=移动&channel=sample&province=湖南&age=30#apply-panel", { province: "广东", city: "深圳市", age: "25" });
  const updated = new URL(href, "https://example.test");
  assert.equal(updated.searchParams.get("keyword"), "电信");
  assert.equal(updated.searchParams.get("operator"), "移动");
  assert.equal(updated.searchParams.get("channel"), "sample");
  assert.equal(updated.searchParams.get("city"), "深圳市");
  assert.equal(updated.hash, "#apply-panel");
  const cleared = new URL(requirementsHref(href, emptyRequirements), "https://example.test");
  for (const key of ["province", "city", "age"]) assert.equal(cleared.searchParams.has(key), false);
  assert.equal(cleared.searchParams.get("channel"), "sample");
  assert.equal(cleared.searchParams.get("keyword"), "电信");
  assert.equal(cleared.hash, "#apply-panel");
});
