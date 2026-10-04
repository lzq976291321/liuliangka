import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = await getCatalog();
    if (!catalog.products.length) return NextResponse.json({ message: "暂时无法取得套餐资料，请稍后重试" }, { status: 503 });
    return NextResponse.json(catalog, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "更新套餐失败，已保留当前资料" }, { status: 503 });
  }
}
