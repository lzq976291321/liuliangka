import crypto from "node:crypto";
import { sampleProducts } from "@/lib/sample-products";
import type { CardProduct, Operator } from "@/lib/types";

type Product172 = {
  productID: number;
  productName: string;
  mainPic: string;
  area: string;
  disableArea: string;
  littlepicture?: string;
  netAddr?: string;
  flag: boolean;
  numberSel: 0 | 1 | 2;
  operator: Operator;
  BackMoneyType: string;
  Taocan: string;
  Rule: string;
  Age1: number;
  Age2: number;
  PriceTime: string;
  Skus?: Array<{ SkuID: number; SkuName: string; Desc: string }>;
};

type ProductsResponse = {
  data?: Product172[];
  code: number;
  message: string;
  errs: unknown;
};

const PRODUCTS_URL = "https://haokaopenapi.lot-ml.com/api/order/GetProductsV2";

function md5(value: string) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function signGetProducts(params: { ProductID: string; Timestamp: string; user_id: string }, secret: string) {
  return md5(`ProductID=${params.ProductID}&Timestamp=${params.Timestamp}&user_id=${params.user_id}${secret}`);
}

function extractNumber(pattern: RegExp, text: string, fallback: number) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : fallback;
}

function normalize172Product(product: Product172): CardProduct {
  const monthlyRent = extractNumber(/(\d+)\s*元\s*\/?\s*月/, product.Taocan, 39);
  const dataGB = extractNumber(/(\d+)\s*G/, product.Taocan, 100);

  return {
    productID: product.productID,
    productName: product.productName,
    mainPic: product.mainPic,
    area: product.area,
    disableArea: product.disableArea ? product.disableArea.split(/[,，、]/).filter(Boolean) : [],
    littlepicture: product.littlepicture,
    netAddr: product.netAddr,
    flag: product.flag,
    numberSel: product.numberSel,
    operator: product.operator,
    backMoneyType: product.BackMoneyType,
    taocan: product.Taocan,
    rule: product.Rule,
    age1: product.Age1,
    age2: product.Age2,
    priceTime: product.PriceTime,
    skus: (product.Skus ?? []).map((sku) => ({
      id: sku.SkuID,
      name: sku.SkuName,
      description: sku.Desc
    })),
    monthlyRent,
    dataGB,
    callMinutes: extractNumber(/(\d+)\s*分钟/, product.Taocan, 0),
    commission: 0,
    tags: [product.operator, product.PriceTime, product.BackMoneyType].filter(Boolean),
    scenes: [],
    cities: product.area.includes("广东") ? ["shenzhen", "guangzhou", "dongguan"] : [],
    warnings: ["接口商品需二次补充套餐标签、佣金和场景信息"],
    applyUrl: product.netAddr || "#apply-panel"
  };
}

export async function getProductsFrom172(productId = ""): Promise<CardProduct[]> {
  const userId = process.env.HAOKA172_USER_ID;
  const secret = process.env.HAOKA172_SECRET;

  if (!userId || !secret) {
    return sampleProducts;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = {
    ProductID: productId,
    Timestamp: timestamp,
    user_id: userId
  };
  const form = new FormData();
  form.set("user_id", userId);
  form.set("Timestamp", timestamp);
  form.set("ProductID", productId);
  form.set("user_sign", signGetProducts(params, secret));

  const response = await fetch(PRODUCTS_URL, {
    method: "POST",
    body: form,
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    return sampleProducts;
  }

  const payload = (await response.json()) as ProductsResponse;
  if (payload.code !== 0 || !payload.data?.length) {
    return sampleProducts;
  }

  return payload.data.map(normalize172Product);
}

export async function getAllProducts() {
  return getProductsFrom172("");
}

export async function getProductById(productId: string) {
  const products = await getAllProducts();
  return products.find((product) => String(product.productID) === productId);
}
