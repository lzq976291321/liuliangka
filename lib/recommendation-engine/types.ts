import type { GuideRecommendation } from "@/lib/guide-recommendation";
import type { CardProduct, GuideIntent } from "@/lib/types";

export type RecommendationEngineName = "local" | "recombee";

export type RecommendInput = {
  products: CardProduct[];
  intent: GuideIntent;
  limit?: number;
  userId?: string;
  scenario?: string;
};

export type RecommendationProviderResult = {
  engine: RecommendationEngineName;
  recommendations: GuideRecommendation[];
  recommId?: string;
  fallback?: boolean;
  message?: string;
};

export type RecommendationProvider = {
  name: RecommendationEngineName;
  recommend(input: RecommendInput): Promise<RecommendationProviderResult>;
};
