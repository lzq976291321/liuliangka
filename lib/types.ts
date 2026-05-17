export type Operator = "移动" | "联通" | "电信" | "广电";

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
  callMinutes: number;
  commission: number;
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
