import { requests, type BatchResponse } from "recombee-api-client";
import { enrichProducts } from "@/lib/product-knowledge";
import { createRecombeeClient } from "@/lib/recommendation-engine/recombee-client";
import type { CardProduct } from "@/lib/types";

export const recombeeItemProperties = [
  { name: "productName", type: "string" },
  { name: "productId", type: "int" },
  { name: "operator", type: "string" },
  { name: "category", type: "string" },
  { name: "status", type: "string" },
  { name: "deleted", type: "boolean" },
  { name: "monthlyRent", type: "int" },
  { name: "dataGB", type: "int" },
  { name: "generalDataGB", type: "int" },
  { name: "directedDataGB", type: "int" },
  { name: "callMinutes", type: "int" },
  { name: "firstRechargeAmount", type: "int" },
  { name: "isLongTerm", type: "boolean" },
  { name: "cities", type: "set" },
  { name: "scenes", type: "set" },
  { name: "tags", type: "set" },
  { name: "priceTime", type: "string" },
  { name: "area", type: "string" },
  { name: "updatedAt", type: "timestamp" }
] as const;

export function toRecombeeItemId(product: CardProduct) {
  return String(product.productID);
}

export function toRecombeeItemValues(product: CardProduct) {
  return {
    productName: product.productName,
    productId: product.productID,
    operator: product.operator,
    category: product.category ?? "unknown",
    status: product.status ?? (product.flag ? "active" : "inactive"),
    deleted: product.status !== "active" || product.category !== "mobile-card",
    monthlyRent: product.monthlyRent,
    dataGB: product.dataGB,
    generalDataGB: product.generalDataGB ?? null,
    directedDataGB: product.directedDataGB ?? null,
    callMinutes: product.callMinutes,
    firstRechargeAmount: product.firstRechargeAmount ?? null,
    isLongTerm: Boolean(product.isLongTerm),
    cities: product.cities,
    scenes: product.scenes,
    tags: product.tags,
    priceTime: product.priceTime,
    area: product.area,
    updatedAt: Math.floor(Date.now() / 1000)
  };
}

async function ensureItemProperties(client: NonNullable<ReturnType<typeof createRecombeeClient>>) {
  const existing = await client.send(new requests.ListItemProperties());
  const existingMap = new Map(existing.map((property) => [property.name, property.type]));
  const missing = recombeeItemProperties.filter((property) => !existingMap.has(property.name));

  if (!missing.length) {
    return { added: 0 };
  }

  await client.send(new requests.Batch(missing.map((property) => new requests.AddItemProperty(property.name, property.type))));
  return { added: missing.length };
}

function countBatchFailures(response: BatchResponse) {
  return response.filter((item) => item.code >= 400).length;
}

export async function syncProductsToRecombee(rawProducts: CardProduct[]) {
  const client = createRecombeeClient();
  if (!client) {
    throw new Error("缺少 RECOMBEE_DATABASE_ID 或 RECOMBEE_PRIVATE_TOKEN");
  }

  const products = enrichProducts(rawProducts);
  const propertyResult = await ensureItemProperties(client);
  const requestsToSend = products.map((product) => new requests.SetItemValues(toRecombeeItemId(product), toRecombeeItemValues(product), { cascadeCreate: true }));
  const batchResponse = requestsToSend.length ? await client.send(new requests.Batch(requestsToSend)) : [];

  return {
    total: products.length,
    activeMobileCards: products.filter((product) => product.category === "mobile-card" && product.status === "active").length,
    propertiesAdded: propertyResult.added,
    failed: countBatchFailures(batchResponse)
  };
}
