import { getProvider, Provider } from "@/lib/queries/token";

type ProviderSupport = Record<Provider, boolean>;

export const FEATURES = {
  dashboard:    { api: true,  go: true,  zapo: true  },
  chat:         { api: true,  go: false, zapo: true  },
  settings:     { api: true,  go: true,  zapo: true  },
  proxy:        { api: true,  go: true,  zapo: true  },
  webhook:      { api: true,  go: true,  zapo: true  },
  websocket:    { api: true,  go: false, zapo: false },
  rabbitmq:     { api: true,  go: false, zapo: false },
  sqs:          { api: true,  go: false, zapo: false },
  evoai:        { api: true,  go: false, zapo: false },
  n8n:          { api: true,  go: false, zapo: false },
  evolutionBot: { api: true,  go: false, zapo: false },
  chatwoot:     { api: true,  go: false, zapo: false },
  typebot:      { api: true,  go: false, zapo: false },
  openai:       { api: true,  go: false, zapo: false },
  dify:         { api: true,  go: false, zapo: false },
  flowise:      { api: true,  go: false, zapo: false },
} as const satisfies Record<string, ProviderSupport>;

export type FeatureKey = keyof typeof FEATURES;

export const isFeatureEnabled = (feature: FeatureKey, provider?: Provider): boolean => {
  const p = provider ?? getProvider();
  return FEATURES[feature][p];
};
