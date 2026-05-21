import { getAllProducts } from "../lib/haoka172";
import { enrichProducts } from "../lib/product-knowledge";
import { recombeeItemProperties, syncProductsToRecombee, toRecombeeItemValues } from "../lib/recommendation-engine/recombee-sync";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rawProducts = await getAllProducts();
  const products = enrichProducts(rawProducts);

  if (dryRun) {
    const first = products[0];
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          total: products.length,
          activeMobileCards: products.filter((product) => product.category === "mobile-card" && product.status === "active").length,
          properties: recombeeItemProperties,
          sample: first ? toRecombeeItemValues(first) : null
        },
        null,
        2
      )
    );
    return;
  }

  const result = await syncProductsToRecombee(rawProducts);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
