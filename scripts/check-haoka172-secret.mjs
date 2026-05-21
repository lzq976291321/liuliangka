import crypto from "node:crypto";

const PRODUCTS_URL = "https://haokaopenapi.lot-ml.com/api/order/GetProductsV2";

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function readEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

async function main() {
  const userId = readEnv("HAOKA172_USER_ID");
  const secret = readEnv("HAOKA172_SECRET");
  const productId = process.env.HAOKA172_PRODUCT_ID ?? "";
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
