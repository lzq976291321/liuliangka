import { isGuideBudgetRelaxed, recommendForGuide } from "@/lib/guide-recommendation";
import type { RecommendationProvider, RecommendationProviderResult, RecommendInput } from "@/lib/recommendation-engine/types";

export class LocalRecommendationProvider implements RecommendationProvider {
  name = "local" as const;

  async recommend(input: RecommendInput): Promise<RecommendationProviderResult> {
    const budgetRelaxed = isGuideBudgetRelaxed(input.products, input.intent);

    return {
      engine: this.name,
      recommendations: recommendForGuide(input.products, input.intent).slice(0, input.limit ?? 4),
      message: budgetRelaxed && typeof input.intent.budget === "number" ? `当前城市暂时没有 ${input.intent.budget} 元内可推荐卡，先展示最接近预算的备选。` : undefined
    };
  }
}
