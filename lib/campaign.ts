import { buildSiteUrl } from "@/lib/site";

export const channelConfigs = [
  { source: "zhihu", label: "知乎", play: "长回答", angle: "避坑 + 对比 + 推荐" },
  { source: "xiaohongshu", label: "小红书", play: "图文笔记", angle: "预算数字 + 使用场景" },
  { source: "baidu", label: "百度", play: "SEO", angle: "地区词 + 套餐表" }
];

export function getCampaignUrl(path: string, source: string, campaign: string, content: string) {
  const url = new URL(buildSiteUrl(path));
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "content");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", content);
  return url.toString();
}
