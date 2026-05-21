export type Operator = "移动" | "联通" | "电信" | "广电";
export type ProductCategory = "mobile-card" | "broadband" | "unknown";
export type ProductStatus = "active" | "inactive" | "hidden" | "needs_review";

export type SkuRegion = {
  id: number;
  name: string;
  description: string;
};

export type CardProduct = {
  productID: number;
  productName: string;
  mainPic: string;
  area: string;
  disableArea: string[];
  littlepicture?: string;
  netAddr?: string;
  flag: boolean;
  numberSel: 0 | 1 | 2;
  operator: Operator;
  backMoneyType: string;
  taocan: string;
  rule: string;
  age1: number;
  age2: number;
  priceTime: string;
  skus: SkuRegion[];
  monthlyRent: number;
  dataGB: number;
  generalDataGB?: number;
  directedDataGB?: number;
  callMinutes: number;
  firstRechargeAmount?: number;
  commission: number;
  category?: ProductCategory;
  status?: ProductStatus;
  isLongTerm?: boolean;
  priority?: number;
  sellingPoints?: string[];
  tags: string[];
  scenes: string[];
  cities: string[];
  warnings: string[];
  applyUrl: string;
};

export type RecommendationContext = {
  city?: string;
  scene?: string;
  budget?: number;
  dataNeedGB?: number;
  operator?: Operator | "不限";
  age?: number;
};

export type GuideIntent = RecommendationContext & {
  needCallMinutes?: boolean;
  preferLongTerm?: boolean;
  rawText?: string;
};
