import type { Metadata } from "next";
import { ProductCatalogClient } from "@/app/ProductCatalogClient";
import { getCatalog } from "@/lib/catalog-source";
import { initialVisibleCount } from "@/lib/catalog-state";

export const metadata: Metadata = {
  title: "流量卡筛选办理",
  description: "按月租、通用流量、地区、运营商筛选当前可办理流量卡，办理前请核对套餐规则和地区限制。"
};

export const dynamic = "force-static";
export const revalidate = 1800;

export default async function HomePage() {
  const catalog = await getCatalog();
  return <main className="page"><ProductCatalogClient initialCatalog={{ ...catalog, products: catalog.products.slice(0, initialVisibleCount) }} /></main>;
}
