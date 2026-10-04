export type ProviderId = 'claude' | 'openai' | 'grok'

export interface ProviderCreds {
  apiKey: string
  /** Optional base URL, e.g. your own CORS proxy. Empty = the company's API. */
  baseUrl?: string
}

export interface ModelInfo {
  id: string
  name: string
}

export interface Completion {
  text: string
  inputTokens: number
  outputTokens: number
  /** null when the model has no price in pricing.ts */
  costUsd: number | null
}

export interface Provider {
  id: ProviderId
  label: string
  /** One character shown in the round badge */
  badge: string
  keyUrl: string
  keyPrefix: string
  listModels(creds: ProviderCreds, signal?: AbortSignal): Promise<ModelInfo[]>
  complete(
    creds: ProviderCreds,
    model: string,
    system: string,
    prompt: string,
    signal?: AbortSignal,
  ): Promise<Completion>
}
