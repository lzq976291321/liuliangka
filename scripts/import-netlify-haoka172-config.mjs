import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ACCOUNTS_CONFIG_PATH = path.join(process.cwd(), "config", "haoka172-accounts.json");

function getCliOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] || fallback;
}

function isPlaceholderSecret(value) {
  return !value || /\*|REPLACE_WITH_|REDACT|hidden/i.test(value);
}

function getNetlifyEnv(name, context) {
  const output = execFileSync("npx", ["netlify", "env:get", name, "--context", context, "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000
  }).trim();

  const parsed = JSON.parse(output);
  return typeof parsed === "string" ? parsed : parsed[name];
}

function readExistingConfig() {
  if (!existsSync(ACCOUNTS_CONFIG_PATH)) {
    return {
      defaultAccountId: "default",
      accounts: []
    };
  }

  return JSON.parse(readFileSync(ACCOUNTS_CONFIG_PATH, "utf8"));
}

function upsertAccount(config, account) {
  const nextAccounts = Array.isArray(config.accounts) ? [...config.accounts] : [];
  const index = nextAccounts.findIndex((item) => item.id === account.id);

  if (index === -1) {
    nextAccounts.push(account);
  } else {
    nextAccounts[index] = {
      ...nextAccounts[index],
      ...account
    };
  }

  return {
    defaultAccountId: config.defaultAccountId || account.id,
    accounts: nextAccounts
  };
}

function main() {
  const accountId = getCliOption("--account", "default");
  const accountName = getCliOption("--name", "默认 172 账号");
  const context = getCliOption("--context", "production");
  const existingConfig = readExistingConfig();
  const existingAccount = existingConfig.accounts?.find((item) => item.id === accountId);
  const orderUserId = getCliOption("--order-user-id", existingAccount?.orderUserId);
  const productUserId = getNetlifyEnv("HAOKA172_USER_ID", context);
  const productSecret = getNetlifyEnv("HAOKA172_SECRET", context);

  if (!productUserId) {
    throw new Error("Netlify 未返回 HAOKA172_USER_ID");
  }

  if (isPlaceholderSecret(productSecret)) {
    throw new Error("Netlify 返回的 HAOKA172_SECRET 是脱敏值，不能自动迁移；请手动把真实 secret 填入 config/haoka172-accounts.json");
  }

  if (!orderUserId) {
    throw new Error("缺少 orderUserId，请传入 --order-user-id");
  }

  const nextConfig = upsertAccount(existingConfig, {
    id: accountId,
    name: accountName,
    productUserId,
    productSecret,
    orderUserId
  });

  writeFileSync(ACCOUNTS_CONFIG_PATH, JSON.stringify(nextConfig, null, 2) + "\n");
  console.log(`已写入 172 账号配置：${accountId}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
