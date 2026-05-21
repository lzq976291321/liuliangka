import type { ProductCategory, ProductStatus } from "@/lib/types";

export type ProductOverride = {
  category?: ProductCategory;
  status?: ProductStatus;
  hidden?: boolean;
  priority?: number;
  scenes?: string[];
  cities?: string[];
  sellingPoints?: string[];
  warnings?: string[];
};

export const productOverrides: Record<number, ProductOverride> = {
  1001: {
    priority: 90,
    sellingPoints: ["长期", "低月租", "广东可办"]
  },
  1002: {
    priority: 82,
    sellingPoints: ["高通用流量", "游戏场景", "官方可查长期"]
  },
  1003: {
    priority: 78,
    sellingPoints: ["学生友好", "19元月租", "轻中度使用"]
  },
  1004: {
    priority: 76,
    sellingPoints: ["备用卡", "年龄范围宽", "热点共享"]
  },
  1005: {
    priority: 72,
    sellingPoints: ["超大流量", "直播短视频", "支持选号"]
  },
  1006: {
    priority: 86,
    sellingPoints: ["通话分钟多", "外卖跑腿", "长期属性"]
  },
  1906: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  },
  1911: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  },
  1912: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  },
  1913: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  },
  1966: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  },
  1967: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  },
  1968: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  },
  1969: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  },
  2239: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  },
  2284: {
    category: "mobile-card",
    hidden: true,
    warnings: ["172 未返回套餐正文，先不进入导购推荐"]
  }
};

export function getProductOverride(productId: number) {
  return productOverrides[productId];
}
