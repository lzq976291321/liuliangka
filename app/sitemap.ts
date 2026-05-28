import type { MetadataRoute } from "next";
import { getAllProducts, getOrderLinks } from "@/lib/catalog-source";
import { getRecommendableProducts } from "@/lib/product-knowledge";
import { buildSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [rawProducts, orderLinks] = await Promise.all([getAllProducts(), getOrderLinks()]);
  const products = getRecommendableProducts(rawProducts).filter((product) => {
    const orderLink = orderLinks.get(product.productID);
    return Boolean(orderLink?.shareUrl && orderLink.pudId && orderLink.userId);
  });

  return [
    {
      url: buildSiteUrl("/"),
      lastModified: new Date()
    },
    ...products.map((product) => ({
      url: buildSiteUrl(`/card/${product.productID}`),
      lastModified: new Date()
    }))
  ];
}
