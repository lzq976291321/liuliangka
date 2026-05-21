import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/haoka172";
import { getRecommendableProducts } from "@/lib/product-knowledge";
import { scenarioConfigs } from "@/lib/scenarios";
import { buildSiteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = getRecommendableProducts(await getAllProducts());

  return [
    {
      url: buildSiteUrl("/"),
      lastModified: new Date()
    },
    {
      url: buildSiteUrl("/assistant"),
      lastModified: new Date()
    },
    {
      url: buildSiteUrl("/ops"),
      lastModified: new Date()
    },
    {
      url: buildSiteUrl("/content"),
      lastModified: new Date()
    },
    ...scenarioConfigs.map((scenario) => ({
      url: buildSiteUrl(`/liuliangka/${scenario.slug}`),
      lastModified: new Date()
    })),
    ...scenarioConfigs.map((scenario) => ({
      url: buildSiteUrl(`/poster/${scenario.slug}`),
      lastModified: new Date()
    })),
    ...products.map((product) => ({
      url: buildSiteUrl(`/card/${product.productID}`),
      lastModified: new Date()
    }))
  ];
}
