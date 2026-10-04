import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const staticExtensions = new Set([
  ".js", ".css", ".html", ".txt", ".xml", ".webmanifest",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".webm", ".mp3", ".pdf"
]);
const serverNames = new Set(["server", "standalone", "config", "node_modules"]);
const sourceRootNames = new Set(["app", "pages", "lib", "scripts", "tests"]);
const specialFiles = new Set(["_headers", "_redirects"]);

export async function checkNetlifyPublish(options = {}) {
  const publishDir = path.resolve(options.publishDir ?? ".netlify/static");
  const accountsPath = path.resolve(options.accountsPath ?? "config/haoka172-accounts.json");
  let accounts;
  try {
    accounts = JSON.parse(await readFile(accountsPath, "utf8")).accounts;
  } catch {
    throw new Error("发布预检无法读取账号配置，已阻止上传");
  }
  const secrets = [...new Set((Array.isArray(accounts) ? accounts : [])
    .map((account) => account?.productSecret)
    .filter((value) => typeof value === "string" && value && !/\*|REPLACE_WITH_|REDACT|hidden/i.test(value)))];
  if (!secrets.length) throw new Error("发布预检缺少有效的商品接口密钥，已阻止上传");
  const secretBuffers = secrets.map((value) => Buffer.from(value));

  let files = 0;
  let bytes = 0;
  async function inspect(target, root = false) {
    let stat;
    try { stat = await lstat(target); }
    catch { throw new Error("静态发布目录不存在或无法读取，已阻止上传"); }
    if (stat.isSymbolicLink()) throw new Error("静态发布目录包含符号链接，已阻止上传");
    const name = path.basename(target).toLowerCase();
    const atPublishRoot = path.dirname(target) === publishDir;
    if (!root && (name.startsWith(".") || serverNames.has(name) || (atPublishRoot && sourceRootNames.has(name)) || name.endsWith(".nft.json") || name === "haoka172-accounts.json")) {
      throw new Error("静态发布目录包含服务端或配置条目，已阻止上传");
    }
    if (stat.isDirectory()) {
      for (const entry of await readdir(target)) await inspect(path.join(target, entry));
      return;
    }
    if (root || !stat.isFile() || (!staticExtensions.has(path.extname(name)) && !specialFiles.has(name))) {
      throw new Error("静态发布目录包含异常条目，已阻止上传");
    }
    const content = await readFile(target);
    if (secretBuffers.some((secret) => content.includes(secret))) {
      throw new Error("静态发布文件包含敏感配置，已阻止上传");
    }
    files += 1;
    bytes += content.length;
  }
  await inspect(publishDir, true);
  if (!files) throw new Error("静态发布目录为空，已阻止上传");
  return { publishDir, files, bytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const run = async () => {
    if (process.argv.length > 3) throw new Error("发布预检仅接受一个可选的静态目录参数");
    const result = await checkNetlifyPublish({ publishDir: process.argv[2] });
    console.log(`Netlify 静态发布预检通过：${result.files} 个文件，${result.bytes} 字节`);
  };
  run().catch((error) => {
    // 不输出文件路径、配置内容或原始 I/O 错误，避免错误日志再次暴露敏感值。
    console.error(error instanceof Error && /已阻止上传|发布预检仅接受/.test(error.message) ? error.message : "静态发布预检失败，已阻止上传");
    process.exitCode = 1;
  });
}
