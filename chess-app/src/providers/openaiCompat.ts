// ChatGPT (OpenAI) and Grok (xAI) serve the same Responses API and model list,
// so one implementation covers both with a different base URL.
import { cost } from '../pricing'
import type { Provider, ProviderCreds, ProviderId } from './types'

interface Options {
  id: ProviderId
  label: string
  badge: string
  defaultBaseUrl: string
  keyUrl: string
  keyPrefix: string
  isChatModel: (id: string) => boolean
}

function makeProvider(o: Options): Provider {
  async function request(creds: ProviderCreds, path: string, body?: unknown, signal?: AbortSignal) {
    const base = (creds.baseUrl || o.defaultBaseUrl).replace(/\/+$/, '')
    const res = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${creds.apiKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
    if (!res.ok) throw new Error(`${o.label} API error ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return res.json()
  }

  return {
    id: o.id,
    label: o.label,
    badge: o.badge,
    keyUrl: o.keyUrl,
    keyPrefix: o.keyPrefix,

    async listModels(creds, signal) {
      const data = await request(creds, '/models', undefined, signal)
      return (data.data as { id: string }[])
        .map((m) => m.id)
        .filter(o.isChatModel)
        .sort()
        .reverse()
        .map((id) => ({ id, name: id }))
    },

    async complete(creds, model, system, prompt, signal) {
      const data = await request(creds, '/responses', { model, instructions: system, input: prompt }, signal)
      const u = data.usage ?? {}
      const input: number = u.input_tokens ?? 0
      const output: number = u.output_tokens ?? 0
      const cached: number = u.input_tokens_details?.cached_tokens ?? 0
      let text = ''
      for (const item of data.output ?? []) {
        if (item.type !== 'message') continue
        for (const c of item.content ?? []) if (c.type === 'output_text') text += c.text
      }
      // input_tokens includes cached tokens; those are billed at the cache rate.
      return { text, inputTokens: input, outputTokens: output, costUsd: cost(model, input - cached, output, 0, cached) }
    },
  }
}

// /v1/models also lists embedding, audio, image and other non-chat models.
const OPENAI_SKIP =
  /audio|realtime|tts|transcribe|image|embedding|moderation|search|instruct|dall-e|whisper|davinci|babbage|computer-use/

export const openai = makeProvider({
  id: 'openai',
  label: 'ChatGPT',
  badge: '◎',
  defaultBaseUrl: 'https://api.openai.com/v1',
  keyUrl: 'https://platform.openai.com/api-keys',
  keyPrefix: 'sk-',
  isChatModel: (id) => /^(gpt-|chatgpt-|o\d)/.test(id) && !OPENAI_SKIP.test(id),
})

export const grok = makeProvider({
  id: 'grok',
  label: 'Grok',
  badge: '𝕏',
  defaultBaseUrl: 'https://api.x.ai/v1',
  keyUrl: 'https://console.x.ai',
  keyPrefix: 'xai-',
  isChatModel: (id) => id.startsWith('grok') && !/image|video|imagine/.test(id),
})
