import { claude } from './claude'
import { grok, openai } from './openaiCompat'
import type { Provider, ProviderId } from './types'

export const PROVIDERS: Record<ProviderId, Provider> = { claude, openai, grok }
export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]
export type * from './types'
