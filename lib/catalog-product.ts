import type { CardProduct } from "@/lib/types";

export type CatalogProduct = Pick<CardProduct,
  | "productID" | "productName" | "operator" | "category" | "area"
  | "taocan" | "rule" | "priceTime" | "isLongTerm" | "monthlyRent"
  | "postPromoMonthlyRent" | "averageMonthlyCost" | "prepaidAmount" | "billingPeriodMonths"
  | "dataGB" | "generalDataGB" | "directedDataGB" | "callMinutes" | "firstRechargeAmount"
  | "age1" | "age2" | "numberSel" | "disableArea" | "skus" | "eligibilityText"
  | "updatedAt" | "validationIssues"
> & { imageUrl: string; orderUrl: string };

export type CatalogPayload = {
  products: CatalogProduct[];
  total: number;
  updatedAt?: string;
  stale: boolean;
};
