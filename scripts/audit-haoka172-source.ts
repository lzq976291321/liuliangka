import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { normalize172Product } from "../lib/haoka172";
import { getValidatedProduct } from "../lib/product-facts";
import type { CardProduct } from "../lib/types";
import type { Haoka172OrderLink } from "../lib/haoka172-order-links";
// @ts-expect-error Standalone CLI implementation is native ESM JavaScript.
import { atomicWriteJson, fetchProductsFrom172, fetchOrderLinks, readSnapshot, readOrderSnapshot, saveSourceSnapshots, validateCatalogPair } from "./sync-haoka172-products.mjs";

const dataDir = path.join(process.cwd(), ".data");
const shouldSync = process.argv.includes("--sync");
const snapshotOnly = process.argv.includes("--snapshot");
let snapshotWriteCompleted = false;
type Diagnostic = { endpoint: string; checkedAt: string; httpStatus: number; businessCode: number | null; recordCount: number; pagination: Record<string, number | boolean> };
type RawProduct = Parameters<typeof normalize172Product>[0];
type StoredProduct = { raw: RawProduct; status: string; lastSeenAt?: string; presence?: string };

function safeError(error: unknown) {
  return { name: error instanceof Error ? error.name : "UnknownError", result: "source_query_failed_previous_snapshot_preserved" };
}

function summarize(products: CardProduct[]) {
  const issueCounts: Record<string, number> = {};
  for (const product of products) for (const issue of product.validationIssues ?? []) {
    const label = issue.split("：")[0];
    issueCounts[label] = (issueCounts[label] ?? 0) + 1;
  }
  const dates = products.map((product) => product.updatedAt).filter((value): value is string => Boolean(value)).sort();
  return {
    visibleMobileCards: products.length,
    missingMonthlyRent: products.filter((product) => product.monthlyRent === undefined).length,
    missingFirstRecharge: products.filter((product) => product.firstRechargeAmount === undefined).length,
    missingFirstRechargeWithTextMention: products.filter((product) => product.firstRechargeAmount === undefined && /首充|首次充值|激活.{0,20}(?:充值|强充|充)/.test(product.eligibilityText ?? "")).length,
    missingPostPromoMonthlyRent: products.filter((product) => product.postPromoMonthlyRent === undefined).length,
    missingPostPromoAmongNonLongTermOrUnknown: products.filter((product) => product.isLongTerm !== true && product.postPromoMonthlyRent === undefined).length,
    missingGeneralData: products.filter((product) => product.generalDataGB === undefined).length,
    productsWithValidationIssues: products.filter((product) => product.validationIssues?.length).length,
    staleProducts: products.filter((product) => product.dataFreshness === "stale").length,
    earliestUpdatedAt: dates[0] ?? null,
    latestUpdatedAt: dates.at(-1) ?? null,
    issueCounts
  };
}

function visibleProducts(products: CardProduct[], links: Haoka172OrderLink[]) {
  const byId = new Map(links.map((link) => [link.productID, link]));
  return products.map((product) => getValidatedProduct(product, byId.get(product.productID))).filter((product) => {
    const link = byId.get(product.productID);
    return product.flag && product.status === "active" && product.category === "mobile-card" && Boolean(link?.shareUrl && link.pudId && link.userId);
  });
}

async function main() {
  const [previous, previousOrders] = await Promise.all([readSnapshot(), readOrderSnapshot()]);
  const previousProducts = (Object.values(previous.products ?? {}) as StoredProduct[]).filter((item) => item.status === "active" && item.raw).map((item) => normalize172Product(item.raw, item.lastSeenAt ?? previous.syncedAt));
  const previousLinks = (previousOrders.links ?? []).map((link: Haoka172OrderLink) => ({ ...link, updatedAt: link.updatedAt ?? previousOrders.syncedAt }));
  if (snapshotOnly) {
    if (shouldSync) throw new Error("--snapshot与--sync不能同时使用");
    // 离线解析复核不访问上游，也不改变快照或任何源观察时间。
    const original = await readFile(path.join(dataDir, "source-audit.json"), "utf8").then(JSON.parse).catch(() => ({}));
    const batchProducts = (Object.values(previous.products ?? {}) as StoredProduct[]).filter((item) => item.presence === "confirmed" && item.lastSeenAt === previous.syncedAt && item.raw).map((item) => normalize172Product(item.raw, item.lastSeenAt));
    const batchLinks = previousLinks.filter((link: Haoka172OrderLink) => link.updatedAt === previousOrders.syncedAt);
    const live = visibleProducts(batchProducts, batchLinks);
    const inspectionIds = [3460, 3481, 4011, 4135, 4178, 4343];
    const report = {
      ...original,
      mode: "reparse_local_snapshot",
      parsedAt: new Date().toISOString(),
      sourceSnapshotRefreshed: false,
      snapshotsWritten: false,
      sourceSnapshotUpdatedAt: previous.syncedAt,
      liveCatalog: { ...original.liveCatalog, ...summarize(live) },
      afterSnapshot: summarize(visibleProducts(previousProducts, previousLinks)),
      parsingReview: live.filter((product) => inspectionIds.includes(product.productID)).map((product) => ({
        productID: product.productID,
        monthlyRent: product.monthlyRent ?? null,
        firstRechargeAmount: product.firstRechargeAmount ?? null,
        prepaidAmount: product.prepaidAmount ?? null,
        billingPeriodMonths: product.billingPeriodMonths ?? null,
        dataGB: product.dataGB ?? null,
        validationIssues: product.validationIssues
      }))
    };
    await atomicWriteJson(path.join(dataDir, "source-audit.json"), report);
    console.log(JSON.stringify({ mode: report.mode, parsedAt: report.parsedAt, sourceSnapshotUpdatedAt: report.sourceSnapshotUpdatedAt, liveCatalog: summarize(live), afterSnapshot: report.afterSnapshot, parsingReview: report.parsingReview }, null, 2));
    return;
  }
  const report: Record<string, unknown> = {
    auditedAt: new Date().toISOString(),
    mode: shouldSync ? "read_upstream_and_refresh_local_snapshots" : "read_upstream_only",
    snapshotsWritten: false,
    previousSnapshot: { activeHistoricalCount: previousProducts.length, ...summarize(visibleProducts(previousProducts, previousLinks)) }
  };
  const diagnostics: Record<string, Diagnostic> = {};
  const onDiagnostic = (diagnostic: Diagnostic) => { diagnostics[diagnostic.endpoint] = diagnostic; };
  const results = await Promise.allSettled([fetchProductsFrom172({ onDiagnostic }), fetchOrderLinks({ onDiagnostic })]);
  report.endpoints = diagnostics;
  const failures = results.flatMap((result, index) => result.status === "rejected" ? [{ endpoint: index === 0 ? "products" : "orderCatalog", ...safeError(result.reason) }] : []);
  if (failures.length || results[0].status !== "fulfilled" || results[1].status !== "fulfilled") {
    report.failures = failures;
    await mkdir(dataDir, { recursive: true });
    await atomicWriteJson(path.join(dataDir, "source-audit.json"), report);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }
  const rawProducts: RawProduct[] = results[0].value;
  const orderResult: { userId: string; links: Haoka172OrderLink[] } = results[1].value;
  const checkedAt = new Date().toISOString();
  const liveLinks = orderResult.links.map((link) => ({ ...link, updatedAt: checkedAt }));
  const pair = validateCatalogPair(rawProducts, orderResult);
  report.liveCatalog = { ...pair, ...summarize(visibleProducts(rawProducts.map((product) => normalize172Product(product, checkedAt)), liveLinks)) };
  const baseIds = rawProducts.map((product) => Number(product.productID));
  const paginationProbes = await Promise.all([1, 2].map(async (pageIndex) => {
    try {
      const products: RawProduct[] = await fetchProductsFrom172({ maxRetries: 0, extraParams: { PageIndex: pageIndex, PageSize: 100 } });
      const ids = products.map((product) => Number(product.productID));
      return { pageIndex, pageSize: 100, count: ids.length, uniqueIds: new Set(ids).size, sameIdsAsDefault: ids.join() === baseIds.join(), newIds: ids.filter((id) => !baseIds.includes(id)).length };
    } catch (error) { return { pageIndex, ...safeError(error) }; }
  }));
  report.pagination = { suppliedMetadata: diagnostics.products?.pagination ?? {}, parameterNamesTested: ["PageIndex", "PageSize"], probes: paginationProbes, listingCompleteness: "unverified", missingRecordPolicy: "retain_previous_status_and_timestamp_until_explicitly_verified" };
  const verifiedProducts: RawProduct[] = [];
  const knownProducts = await Promise.all([2586, 2649].map(async (productID) => {
    let diagnostic: Diagnostic | undefined;
    try {
      const found: RawProduct[] = await fetchProductsFrom172({ productId: String(productID), maxRetries: 0, onDiagnostic: (value: Diagnostic) => { diagnostic = value; } });
      const raw = found.find((product) => Number(product.productID) === productID);
      if (raw) verifiedProducts.push(raw);
      const historical = previousProducts.find((product) => product.productID === productID);
      const historicalLink = previousLinks.find((link: Haoka172OrderLink) => link.productID === productID);
      const corrected = historical ? getValidatedProduct(historical, historicalLink) : undefined;
      const currentLink = liveLinks.find((link) => link.productID === productID);
      return {
        productID, diagnostic, presentInLiveList: baseIds.includes(productID), presentInLiveOrderCatalog: Boolean(currentLink), explicitlyActive: raw?.flag ?? null,
        historicalUpstreamOrderPrice: historicalLink?.monthlyRent ?? null,
        correctedHistoricalFacts: corrected ? { monthlyRent: corrected.monthlyRent ?? null, averageMonthlyCost: corrected.averageMonthlyCost ?? null, firstRechargeAmount: corrected.firstRechargeAmount ?? null, validationIssues: corrected.validationIssues } : null,
        finding: raw?.flag === false ? "upstream_explicitly_inactive; historical_price_ambiguity_not_a_current_offer" : "inspect_live_facts"
      };
    } catch (error) { return { productID, diagnostic, ...safeError(error) }; }
  }));
  report.knownProducts = knownProducts;
  report.interpretation = {
    upstreamFacts: "Only records returned or individually confirmed in this audit have a new observation time. Absence from a list is not treated as confirmed delisting.",
    parsingPolicy: "Monthly averages, mandatory first recharge and prepayment are separate facts. Conflicting monthly rent remains unknown and is excluded from price filtering."
  };
  if (shouldSync) {
    const saved = await saveSourceSnapshots(rawProducts, orderResult, { verifiedProducts, syncedAt: checkedAt });
    snapshotWriteCompleted = true;
    report.snapshotsWritten = true;
    report.localRefresh = { ...saved, backupDir: path.relative(process.cwd(), saved.backupDir) };
    const [savedProducts, savedOrders] = await Promise.all([readSnapshot(), readOrderSnapshot()]);
    const active = (Object.values(savedProducts.products) as StoredProduct[]).filter((item) => item.status === "active" && item.raw).map((item) => normalize172Product(item.raw, item.lastSeenAt ?? savedProducts.syncedAt));
    report.afterSnapshot = summarize(visibleProducts(active, savedOrders.links));
  }
  await mkdir(dataDir, { recursive: true });
  await atomicWriteJson(path.join(dataDir, "source-audit.json"), report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async (error) => {
  const report = { auditedAt: new Date().toISOString(), snapshotsWritten: snapshotWriteCompleted, ...safeError(error) };
  await mkdir(dataDir, { recursive: true });
  await atomicWriteJson(path.join(dataDir, "source-audit.json"), report);
  console.error(JSON.stringify(report));
  process.exitCode = 1;
});
