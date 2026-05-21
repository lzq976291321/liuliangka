import { requests } from "recombee-api-client";
import { getGuideCandidateProducts, recommendForGuide } from "@/lib/guide-recommendation";
import { createRecombeeClient } from "@/lib/recommendation-engine/recombee-client";
import { toRecombeeItemId } from "@/lib/recommendation-engine/recombee-sync";
import type { RecommendationProvider, RecommendationProviderResult, RecommendInput } from "@/lib/recommendation-engine/types";
import type { CardProduct, GuideIntent } from "@/lib/types";

const defaultUserId = "anonymous";

function escapeReqlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildCandidateFilter(products: CardProduct[]) {
  if (!products.length) {
    return "'itemId' in {}";
  }

  return `'itemId' in {${products.map((product) => `"${escapeReqlString(toRecombeeItemId(product))}"`).join(",")}}`;
}

function buildBooster(intent: GuideIntent) {
  const boosters: string[] = [];

  if (intent.preferLongTerm) {
    boosters.push("if 'isLongTerm' then 1.18 else 1");
  }

  if (intent.needCallMinutes) {
    boosters.push("if 'callMinutes' != null and 'callMinutes' >= 100 then 1.15 else 1");
  }

  if (typeof intent.dataNeedGB === "number") {
    boosters.push(`if 'dataGB' != null and 'dataGB' >= ${intent.dataNeedGB} then 1.1 else 1`);
  }

  if (typeof intent.budget === "number") {
    boosters.push(`if 'monthlyRent' != null and 'monthlyRent' <= ${intent.budget} then 1.08 else 1`);
  }

  return boosters.length ? boosters.join(" * ") : undefined;
}

function localFallback(input: RecommendInput, message?: string): RecommendationProviderResult {
  return {
    engine: "local",
    recommendations: recommendForGuide(input.products, input.intent).slice(0, input.limit ?? 4),
    fallback: true,
    message
  };
}

export class RecombeeRecommendationProvider implements RecommendationProvider {
  name = "recombee" as const;

  async recommend(input: RecommendInput): Promise<RecommendationProviderResult> {
    const client = createRecombeeClient();
    if (!client) {
      return localFallback(input, "第三方推荐未配置，已使用本地推荐兜底");
    }

    const limit = input.limit ?? 4;
    const candidateProducts = getGuideCandidateProducts(input.products, input.intent);
    if (!candidateProducts.length) {
      return localFallback(input, "没有符合基础条件的候选商品，已使用本地推荐兜底");
    }

    const localRanked = recommendForGuide(candidateProducts, input.intent);
    const localById = new Map(localRanked.map((item) => [toRecombeeItemId(item.product), item]));

    try {
      const response = await client.send(
        new requests.RecommendItemsToUser(input.userId || defaultUserId, limit, {
          scenario: input.scenario,
          cascadeCreate: true,
          filter: buildCandidateFilter(candidateProducts),
          booster: buildBooster(input.intent),
          minRelevance: "low",
          rotationRate: 0.1
        })
      );

      const usedIds = new Set<string>();
      const recombeeRanked = response.recomms.flatMap((item) => {
        const recommendation = localById.get(item.id);
        if (!recommendation) {
          return [];
        }

        usedIds.add(item.id);
        return [recommendation];
      });
      const filled = [...recombeeRanked, ...localRanked.filter((item) => !usedIds.has(toRecombeeItemId(item.product)))].slice(0, limit);

      return {
        engine: this.name,
        recommendations: filled,
        recommId: response.recommId
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("recombee_recommend_failed", message);
      return localFallback(input, "第三方推荐暂时不可用，已使用本地推荐兜底");
    }
  }
}
