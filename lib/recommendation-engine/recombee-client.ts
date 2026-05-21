import { ApiClient } from "recombee-api-client";

export type RecombeeConfig = {
  databaseId: string;
  privateToken: string;
  region?: string;
};

export function getRecombeeConfig(): RecombeeConfig | undefined {
  const databaseId = process.env.RECOMBEE_DATABASE_ID;
  const privateToken = process.env.RECOMBEE_PRIVATE_TOKEN;

  if (!databaseId || !privateToken) {
    return undefined;
  }

  return {
    databaseId,
    privateToken,
    region: process.env.RECOMBEE_REGION || undefined
  };
}

export function createRecombeeClient(config = getRecombeeConfig()) {
  if (!config) {
    return undefined;
  }

  return new ApiClient(config.databaseId, config.privateToken, config.region ? { region: config.region } : undefined);
}
