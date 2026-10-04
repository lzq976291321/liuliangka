import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
// @ts-expect-error Standalone release preflight is native ESM JavaScript.
import { checkNetlifyPublish } from "../scripts/check-netlify-publish.mjs";

const fixtureSecret = "fixture-product-secret-for-publish-test";
async function withFixture(run: (publishDir: string, accountsPath: string, root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "liuliangka-publish-"));
  try {
    const publishDir = path.join(root, "static");
    const accountsPath = path.join(root, "accounts.json");
    await mkdir(publishDir);
    await writeFile(accountsPath, JSON.stringify({ accounts: [{ productSecret: fixtureSecret }] }));
    await run(publishDir, accountsPath, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("Netlify预检允许正常静态JS/CSS并统计实际文件", async () => {
  await withFixture(async (publishDir, accountsPath) => {
    const chunks = path.join(publishDir, "_next", "static", "chunks");
    await mkdir(chunks, { recursive: true });
    await writeFile(path.join(chunks, "app.js"), "console.log('public');");
    await writeFile(path.join(chunks, "app.css"), "body{color:black}");
    await mkdir(path.join(chunks, "app"));
    await writeFile(path.join(chunks, "app", "page.js"), "console.log('public page');");
    await mkdir(path.join(chunks, "pages"));
    await writeFile(path.join(chunks, "pages", "_app.js"), "console.log('public app');");
    const result = await checkNetlifyPublish({ publishDir, accountsPath });
    assert.equal(result.files, 4);
    assert.ok(result.bytes > 0);
  });
});

test("Netlify预检阻断误传Next构建目录及服务端配置", async () => {
  await withFixture(async (publishDir, accountsPath) => {
    for (const relative of ["standalone/config/haoka172-accounts.json", "server/app/page.js", ".env.production", "page.js.nft.json", "cache/trace", "package.json"]) {
      const target = path.join(publishDir, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "fixture");
      await assert.rejects(checkNetlifyPublish({ publishDir, accountsPath }), /已阻止上传/);
      await rm(publishDir, { recursive: true });
      await mkdir(publishDir);
    }
  });
});

test("Netlify预检阻断静态文件内的真实密钥且错误不回显密钥", async () => {
  await withFixture(async (publishDir, accountsPath) => {
    await writeFile(path.join(publishDir, "app.js"), `const value=${JSON.stringify(fixtureSecret)};`);
    await assert.rejects(checkNetlifyPublish({ publishDir, accountsPath }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /敏感配置/);
      assert.ok(!error.message.includes(fixtureSecret));
      return true;
    });
  });
});

test("Netlify预检阻断符号链接、空目录和不存在的目录", async () => {
  await withFixture(async (publishDir, accountsPath, root) => {
    await assert.rejects(checkNetlifyPublish({ publishDir, accountsPath }), /为空/);
    await assert.rejects(checkNetlifyPublish({ publishDir: path.join(root, "missing"), accountsPath }), /不存在/);
    await symlink(accountsPath, path.join(publishDir, "app.js"));
    await assert.rejects(checkNetlifyPublish({ publishDir, accountsPath }), /符号链接/);
  });
});
