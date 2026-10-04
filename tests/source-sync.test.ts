import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
// @ts-expect-error Standalone CLI implementation is native ESM JavaScript.
import { atomicWriteJson, buildNextSnapshot, diffFields, fetchOrderLinks, fetchProductsFrom172, normalizeProduct, readOrderSnapshot, readSnapshot, saveSourceSnapshots, validateCatalogPair } from "../scripts/sync-haoka172-products.mjs";

const fakeAccount = { productUserId: "fixture", productSecret: "fixture-secret", orderUserId: "fixture" };
const raw = (productID: number, flag = true) => ({ productID, productName: `套餐${productID}`, taocan: "29元100G", rule: "禁止异地激活", age1: 18, age2: 60, flag });
const link = (productID: number) => ({ productID, productName: `套餐${productID}`, shareUrl: "https://example.invalid/order", pudId: "fixture", userId: "fixture", monthlyRent: "29" });

test("大小写源字段进入同一diff，不遗漏小写套餐规则年龄变化", () => {
  const lower = normalizeProduct(raw(1));
  const upper = normalizeProduct({ productID: 1, productName: "套餐1", Taocan: "29元100G", Rule: "禁止异地激活", Age1: 18, Age2: 60, flag: true });
  assert.equal(lower.hash, upper.hash);
  const changed = normalizeProduct({ ...raw(1), rule: "仅限广东激活", age2: 55 });
  assert.deepEqual(diffFields(lower.compareFields, changed.compareFields).sort(), ["Age2", "Rule"]);
});

test("空数据和业务失败不能被当成有效新目录", async () => {
  for (const payload of [{ code: 0, data: [] }, { code: -1, data: [raw(1)] }]) {
    const fetchImpl = async () => new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    await assert.rejects(fetchProductsFrom172({ account: fakeAccount, fetchImpl, maxRetries: 0 }));
    await assert.rejects(fetchOrderLinks({ account: fakeAccount, fetchImpl, maxRetries: 0 }));
  }
  assert.throws(() => validateCatalogPair([raw(1)], { links: [link(2)] }), /没有匹配/);
  assert.throws(() => validateCatalogPair([raw(1), raw(1)], { links: [link(1)] }), /重复/);
});

test("两源请求都有超时，失败不产生成功结果", async () => {
  const fetchImpl = (_url: unknown, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("fixture timeout")), { once: true });
  });
  await assert.rejects(fetchProductsFrom172({ account: fakeAccount, fetchImpl, timeoutMs: 5, maxRetries: 0 }), /timeout/);
  await assert.rejects(fetchOrderLinks({ account: fakeAccount, fetchImpl, timeoutMs: 5, maxRetries: 0 }), /timeout/);
});

test("列表缺失保留原状态和时间，明确flag=false才下架", () => {
  const oldTime = "2026-06-02T15:05:12.329Z";
  const first = buildNextSnapshot({ products: {} }, [normalizeProduct(raw(1)), normalizeProduct(raw(2))], oldTime).snapshot;
  const next = buildNextSnapshot(first, [normalizeProduct(raw(2, false))], "2026-10-04T00:00:00.000Z").snapshot;
  assert.equal(next.products[1].status, "active");
  assert.equal(next.products[1].lastSeenAt, oldTime);
  assert.equal(next.products[1].presence, "unconfirmed");
  assert.equal(next.products[2].status, "inactive");
});

test("两源先验证再原子更新，保存旧快照并保留历史链接时间", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "liuliangka-source-test-"));
  try {
    const firstTime = "2026-06-02T15:05:12.329Z";
    await saveSourceSnapshots([raw(1), raw(2)], { userId: "fixture", links: [link(1), link(2)] }, { dataDir, syncedAt: firstTime });
    const bundlePath = path.join(dataDir, "haoka172-catalog-snapshot.json");
    const original = await readFile(bundlePath, "utf8");
    await assert.rejects(saveSourceSnapshots([], { userId: "fixture", links: [link(1)] }, { dataDir }));
    assert.equal(await readFile(bundlePath, "utf8"), original);
    const result = await saveSourceSnapshots([raw(1)], { userId: "fixture", links: [link(1)] }, { dataDir, syncedAt: "2026-10-04T00:00:00.000Z" });
    assert.equal(await readFile(path.join(result.backupDir, "haoka172-catalog-snapshot.json"), "utf8"), original);
    const products = await readSnapshot(dataDir);
    const orders = await readOrderSnapshot(dataDir);
    assert.equal(products.products[2].lastSeenAt, firstTime);
    assert.equal(orders.links.find((item: { productID: number }) => item.productID === 2).updatedAt, firstTime);
    assert.equal(products.syncedAt, orders.syncedAt);
    assert.ok(!(await readdir(dataDir)).some((name) => name.endsWith(".tmp")));
    // 单文件兼容导出损坏时，读取仍使用原子提交的双源bundle。
    await writeFile(path.join(dataDir, "haoka172-products-snapshot.json"), "broken", "utf8");
    assert.equal((await readSnapshot(dataDir)).syncedAt, products.syncedAt);
    await assert.rejects(atomicWriteJson(dataDir, { invalidTarget: true }));
    assert.equal((await readSnapshot(dataDir)).syncedAt, products.syncedAt);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
