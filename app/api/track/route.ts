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
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as TrackEvent | null;
  if (!payload?.event) {
    return NextResponse.json({ ok: false, message: "invalid event" }, { status: 400 });
  }

  const event = {
    ...payload,
    createdAt: new Date().toISOString()
  };

  await sendWebhook(event);
  await writeLocalEvent(event);

  return NextResponse.json({ ok: true });
}

async function sendWebhook(event: TrackEvent & { createdAt: string }) {
  const webhookUrl = process.env.TRACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.TRACK_WEBHOOK_SECRET ? { "X-Track-Secret": process.env.TRACK_WEBHOOK_SECRET } : {})
    },
    body: JSON.stringify(event)
  }).catch(() => undefined);
}

async function writeLocalEvent(event: TrackEvent & { createdAt: string }) {
  if (process.env.NODE_ENV === "production") {
    console.info("track_event", JSON.stringify(event));
    return;
  }

  const dataDir = path.join(process.cwd(), ".data");
  await mkdir(dataDir, { recursive: true });
  await appendFile(path.join(dataDir, "events.jsonl"), JSON.stringify(event) + "\n", "utf8").catch(() => undefined);
}
