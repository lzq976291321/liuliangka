import type { Metadata } from "next";
import { ProductCatalogClient } from "@/app/ProductCatalogClient";
import type { CatalogProduct } from "@/app/ProductCatalogClient";
import { getAllProducts, getOrderLinks } from "@/lib/catalog-source";
import { enrichProducts } from "@/lib/product-knowledge";

export const metadata: Metadata = {
  title: "流量卡筛选办理",
  description: "按月租、通用流量、地区、运营商筛选当前可办理流量卡，办理前请核对套餐规则和地区限制。"
};

export const dynamic = "force-static";

function toNumber(value?: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : undefined;
}

export default async function HomePage() {
  const rawProducts = await getAllProducts();
  const orderLinks = await getOrderLinks();
  const activeProducts = enrichProducts(rawProducts).filter((product) => product.flag);
  const products = activeProducts.flatMap<CatalogProduct>((product) => {
    const orderLink = orderLinks.get(product.productID);

    if (!orderLink?.shareUrl || !orderLink.pudId || !orderLink.userId) {
      return [];
    }

    return [
      {
        productID: product.productID,
        productName: product.productName,
        imageUrl: product.littlepicture || product.mainPic,
        operator: product.operator,
        category: product.category,
        area: product.area,
        taocan: product.taocan,
        rule: product.rule,
        priceTime: product.priceTime,
        backMoneyType: product.backMoneyType,
        isLongTerm: product.isLongTerm,
        dataGB: product.dataGB,
        firstRechargeAmount: product.firstRechargeAmount,
        numberSel: product.numberSel,
        monthlyRent: toNumber(orderLink.monthlyRent) ?? product.monthlyRent,
        generalDataGB: toNumber(orderLink.generalDataGB) ?? product.generalDataGB,
        directedDataGB: toNumber(orderLink.directedDataGB) ?? product.directedDataGB,
        callMinutes: toNumber(orderLink.callMinutes) ?? product.callMinutes,
        age1: orderLink.age1 ?? product.age1,
        age2: orderLink.age2 ?? product.age2,
        orderUrl: orderLink.shareUrl
      }
    ];
  });

  return (
    <main className="page">
      <ProductCatalogClient products={products} />
    </main>
  );
}
