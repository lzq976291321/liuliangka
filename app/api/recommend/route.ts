import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/haoka172";
import { getRecommendableProducts } from "@/lib/product-knowledge";
import { recommendProducts } from "@/lib/recommendation-engine";
import type { GuideIntent } from "@/lib/types";

export const runtime = "nodejs";

type RecommendPayload = {
  intent?: GuideIntent;
  limit?: number;
  userId?: string;
  scenario?: string;
};

function clampLimit(value: unknown) {
  const limit = Number(value);
  if (!Number.isFinite(limit)) {
    return 4;
  }

  return Math.max(1, Math.min(8, Math.round(limit)));
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as RecommendPayload | null;
  if (!payload?.intent) {
    return NextResponse.json({ ok: false, message: "invalid intent" }, { status: 400 });
  }

  const rawProducts = await getAllProducts();
  const products = getRecommendableProducts(rawProducts);
  const result = await recommendProducts({
    products,
    intent: payload.intent,
    limit: clampLimit(payload.limit),
    userId: payload.userId,
    scenario: payload.scenario
  });

  return NextResponse.json({ ok: true, ...result });
}
