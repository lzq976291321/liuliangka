import { getAllProducts as fetchProducts, getProductsSourceState, getLastValidProductSnapshot } from "@/lib/haoka172";
import { getHaoka172OrderLinks, getOrderLinksSourceState, getLastValidOrderLinkSnapshot, type Haoka172OrderLink } from "@/lib/haoka172-order-links";
import { getValidatedProduct } from "@/lib/product-facts";
import type { CatalogPayload, CatalogProduct } from "@/lib/catalog-product";
import { isProductStale } from "@/lib/product-display";
import type { CardProduct } from "@/lib/types";

type SourcePair = { products: CardProduct[]; links: Map<number, Haoka172OrderLink>; fallback: boolean };
let lastPair: SourcePair | undefined;
let expiresAt = 0;
let inFlight: Promise<SourcePair> | undefined;

async function getSourcePair(): Promise<SourcePair> {
  if (lastPair && expiresAt > Date.now()) return lastPair;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const [products, links] = await Promise.all([fetchProducts(), getHaoka172OrderLinks()]);
      const productState = getProductsSourceState();
      const orderState = getOrderLinksSourceState();
      if (!products.length || !links.size || productState.status === "fallback" || orderState.status === "fallback") throw new Error("incomplete source refresh");
      lastPair = { products, links, fallback: false };
      expiresAt = Math.min(Date.now() + 30 * 60 * 1000, ...[productState.updatedAt, orderState.updatedAt].flatMap((value) => value && Number.isFinite(Date.parse(value)) ? [Date.parse(value) + 30 * 60 * 1000] : []));
      return lastPair;
    } catch {
      if (lastPair) lastPair = { ...lastPair, fallback: true };
      else {
        const [products, links] = await Promise.all([getLastValidProductSnapshot(), getLastValidOrderLinkSnapshot()]);
        lastPair = { products, links, fallback: true };
      }
      expiresAt = Date.now() + 60 * 1000;
      return lastPair;
    }
  })();
  try { return await inFlight; } finally { inFlight = undefined; }
}

export async function getAllProducts() { return (await getSourcePair()).products; }
export async function getOrderLinks() { return (await getSourcePair()).links; }
export async function getProductById(productId: string) { return (await getAllProducts()).find((product) => String(product.productID) === productId); }

export async function getCatalog(): Promise<CatalogPayload> {
  const { products: rawProducts, links, fallback } = await getSourcePair();
  const products = rawProducts.flatMap<CatalogProduct>((raw) => {
    const link = links.get(raw.productID);
    const product = getValidatedProduct(raw, link);
    if (!product.flag || product.status !== "active" || product.category !== "mobile-card" || !link?.shareUrl || !link.pudId || !link.userId) return [];
    return [{
      productID: product.productID, productName: product.productName,
      imageUrl: product.littlepicture || product.mainPic, orderUrl: link.shareUrl,
      operator: product.operator, category: product.category, area: product.area,
      taocan: product.taocan, rule: product.rule, priceTime: product.priceTime,
      isLongTerm: product.isLongTerm, monthlyRent: product.monthlyRent,
      postPromoMonthlyRent: product.postPromoMonthlyRent,
      averageMonthlyCost: product.averageMonthlyCost, prepaidAmount: product.prepaidAmount,
      billingPeriodMonths: product.billingPeriodMonths,
      dataGB: product.dataGB, generalDataGB: product.generalDataGB, directedDataGB: product.directedDataGB,
      callMinutes: product.callMinutes, firstRechargeAmount: product.firstRechargeAmount,
      age1: product.age1, age2: product.age2, numberSel: product.numberSel,
      disableArea: product.disableArea, skus: product.skus, eligibilityText: product.eligibilityText,
      updatedAt: product.updatedAt, validationIssues: product.validationIssues
    }];
  });
  products.sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0) || a.productID - b.productID);
  const timestamps = products.flatMap((p) => p.updatedAt && Number.isFinite(Date.parse(p.updatedAt)) ? [Date.parse(p.updatedAt)] : []);
  return { products, total: products.length, updatedAt: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : undefined, stale: fallback || !products.length || products.some((product) => isProductStale(product.updatedAt)) };
}
