import { requests } from "recombee-api-client";
import { createRecombeeClient } from "@/lib/recommendation-engine/recombee-client";

type RecombeeTrackEvent = {
  event: string;
  productId?: number;
  userId?: string;
  recommId?: string;
  source?: string;
  engine?: string;
};

export async function reportRecombeeEvent(event: RecombeeTrackEvent) {
  if (!event.productId || !event.userId) {
    return;
  }

  const client = createRecombeeClient();
  if (!client) {
    return;
  }

  const itemId = String(event.productId);
  const options = {
    cascadeCreate: true,
    recommId: event.recommId,
    additionalData: {
      source: event.source,
      engine: event.engine
    }
  };

  if (event.event === "apply_click") {
    await client.send(new requests.AddCartAddition(event.userId, itemId, options));
    return;
  }

  if (event.event === "order_success" || event.event === "purchase") {
    await client.send(new requests.AddPurchase(event.userId, itemId, options));
    return;
  }

  if (event.event === "detail_view" || event.event === "product_view") {
    await client.send(new requests.AddDetailView(event.userId, itemId, options));
  }
}
