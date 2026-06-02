import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const PRODUCTS_URL = "https://haokaopenapi.lot-ml.com/api/order/GetProductsV2";
const ACCOUNTS_CONFIG_PATH = path.join(process.cwd(), "config", "haoka172-accounts.json");

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function getCliOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function isPlaceholderSecret(value) {
  return !value || /\*|REPLACE_WITH_|REDACT|hidden/i.test(value);
}

function getSelectedAccount() {
  const config = JSON.parse(readFileSync(ACCOUNTS_CONFIG_PATH, "utf8"));
  const accountId = getCliOption("--account") || config.defaultAccountId;
  const account = config.accounts?.find((item) => item.id === accountId);

  if (!account?.productUserId) {
    throw new Error(`172 账号配置无效：${accountId}`);
  }

  if (isPlaceholderSecret(account.productSecret)) {
    throw new Error(`172 账号 ${accountId} 的 productSecret 仍是占位或脱敏值，请在 config/haoka172-accounts.json 填入真实 secret`);
  }

  return account;
}

async function main() {
  const account = getSelectedAccount();
  const userId = account.productUserId;
  const secret = account.productSecret;
  const productId = account.productId ?? "";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const userSign = md5(`ProductID=${productId}&Timestamp=${timestamp}&user_id=${userId}${secret}`);

  const form = new FormData();
  form.set("user_id", userId);
  form.set("Timestamp", timestamp);
  form.set("ProductID", productId);
  form.set("user_sign", userSign);

  const response = await fetch(PRODUCTS_URL, {
    method: "POST",
    body: form
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  console.log("HTTP 状态:", response.status, response.statusText);

  if (!payload) {
    console.log("接口返回不是 JSON:");
    console.log(text.slice(0, 500));
    process.exitCode = 1;
    return;
  }

  console.log("业务 code:", payload.code);
  console.log("业务 message:", payload.message);

  if (Array.isArray(payload.data)) {
    console.log("商品数量:", payload.data.length);
    console.log(
      "前 3 个商品:",
      payload.data
        .slice(0, 3)
        .map((item) => `${item.productID}:${item.productName}`)
        .join(" | ") || "无"
    );
  } else {
    console.log("data 类型:", typeof payload.data);
  }

  if (!response.ok || payload.code !== 0 || !Array.isArray(payload.data)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
