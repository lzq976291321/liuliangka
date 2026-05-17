import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/haoka172";
import { scenarioConfigs } from "@/lib/scenarios";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://local-card.example";
  const products = await getAllProducts();

  return [
    {
      url: baseUrl,
      lastModified: new Date()
    },
    {
      url: `${baseUrl}/assistant`,
      lastModified: new Date()
    },
    ...scenarioConfigs.map((scenario) => ({
      url: `${baseUrl}/liuliangka/${scenario.slug}`,
      lastModified: new Date()
    })),
    ...products.map((product) => ({
      url: `${baseUrl}/card/${product.productID}`,
      lastModified: new Date()
    }))
  ];
}
