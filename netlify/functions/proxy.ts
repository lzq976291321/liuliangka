import { Handler } from "@netlify/functions";
import fetch from "node-fetch";

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // 解析 x-www-form-urlencoded body
  let bodyObj: Record<string, string> = {};
  if (event.body) {
    bodyObj = Object.fromEntries(new URLSearchParams(event.body));
  }

  // 组装 body
  const body = Object.entries(bodyObj)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");

  // 发起远程请求
  const response = await fetch("https://h5.lot-ml.com/H5OrderEn/Save", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://h5.lot-ml.com",
      Referer:
        "https://h5.lot-ml.com/h5orderEn/index?pudID=3a63e330af913423&userid=5879e81e899912ce",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });
  const text = await response.text();
  return {
    statusCode: response.status,
    body: text,
  };
};

export { handler };
