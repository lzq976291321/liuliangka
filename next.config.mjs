/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  outputFileTracingIncludes: {
    "/*": ["./.data/haoka172-catalog-snapshot.json", "./.data/haoka172-products-snapshot.json", "./.data/haoka172-order-links-snapshot.json", "./config/haoka172-accounts.json"]
  }
};

export default nextConfig;
