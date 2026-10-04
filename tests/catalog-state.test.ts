import test from "node:test";
import assert from "node:assert/strict";
import { catalogStateSearch, defaultCatalogState, parseCatalogState, restoreCatalogState } from "../lib/catalog-state";

test("shared URL filters override stored filters while preserving unrelated parameters", () => {
  const saved = { ...defaultCatalogState, keyword: "广东", operator: "移动", visibleCount: 60, scrollY: 1600 };
  const restored = restoreCatalogState("?operator=联通&price=20-29&channel=friend&age=25", saved);
  assert.equal(restored.operator, "联通");
  assert.equal(restored.keyword, "");
  assert.equal(restored.visibleCount, 12);
  assert.equal(restored.scrollY, 0);
  const query = new URLSearchParams(catalogStateSearch("?age=25&channel=friend", restored));
  assert.equal(query.get("age"), "25");
  assert.equal(query.get("channel"), "friend");
  assert.equal(query.get("price"), "20-29");
});

test("detail return and same-filter reload restore comparison, rendered count and scroll", () => {
  const saved = { ...defaultCatalogState, comparisonIds: [12, 13], visibleCount: 60, scrollY: 1500 };
  assert.deepEqual(restoreCatalogState("?age=25", saved), saved);
  assert.deepEqual(restoreCatalogState(catalogStateSearch("", saved), saved), saved);
});

test("malformed storage and comparison IDs cannot corrupt controls", () => {
  assert.deepEqual(parseCatalogState(null), defaultCatalogState);
  const restored = parseCatalogState({ operator: "fake", comparisonIds: [1, 1, -1, "2", 2, 3, 4], scrollY: -1, visibleCount: Infinity });
  assert.deepEqual(restored.comparisonIds, [1, 2, 3]);
  assert.equal(restored.visibleCount, 12);
  assert.equal(restored.operator, "全部");
  assert.equal(restored.scrollY, 0);
  assert.equal(restoreCatalogState("?catalog=1", { ...defaultCatalogState, keyword: "old" }).keyword, "");
});
