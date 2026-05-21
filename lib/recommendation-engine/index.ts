import { LocalRecommendationProvider } from "@/lib/recommendation-engine/local";
import { RecombeeRecommendationProvider } from "@/lib/recommendation-engine/recombee";
import type { RecommendationProvider, RecommendationEngineName, RecommendInput } from "@/lib/recommendation-engine/types";

function getProviderName(): RecommendationEngineName {
  return process.env.RECOMMENDATION_PROVIDER === "recombee" ? "recombee" : "local";
}

function createProvider(): RecommendationProvider {
  if (getProviderName() === "recombee") {
    return new RecombeeRecommendationProvider();
  }

  return new LocalRecommendationProvider();
}

export async function recommendProducts(input: RecommendInput) {
  return createProvider().recommend(input);
}

export type { RecommendationProviderResult, RecommendInput } from "@/lib/recommendation-engine/types";
