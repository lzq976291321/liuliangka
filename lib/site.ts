const fallbackSiteUrl = "https://liuliangka.netlify.app";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || fallbackSiteUrl).replace(/\/$/, "");

export function buildSiteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}
