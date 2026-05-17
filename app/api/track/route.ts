import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TrackEvent = {
  event: string;
  productId?: number;
  productName?: string;
  source?: string;
  path?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as TrackEvent | null;
  if (!payload?.event) {
    return NextResponse.json({ ok: false, message: "invalid event" }, { status: 400 });
  }

  const dataDir = path.join(process.cwd(), ".data");
  await mkdir(dataDir, { recursive: true });
  await appendFile(
    path.join(dataDir, "events.jsonl"),
    JSON.stringify({
      ...payload,
      createdAt: new Date().toISOString()
    }) + "\n",
    "utf8"
  );

  return NextResponse.json({ ok: true });
}
