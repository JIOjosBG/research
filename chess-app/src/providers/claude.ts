import Anthropic from '@anthropic-ai/sdk'
import { cost } from '../pricing'
import type { Provider, ProviderCreds } from './types'

function client({ apiKey, baseUrl }: ProviderCreds) {
  return new Anthropic({
    apiKey,
    baseURL: baseUrl || undefined,
    // The key belongs to the person using this page and never leaves their browser
    // except to go to Anthropic, so browser use is intended here.
    dangerouslyAllowBrowser: true,
  })
}

export const claude: Provider = {
  id: 'claude',
  label: 'Claude',
  badge: '✳',
  keyUrl: 'https://console.anthropic.com/settings/keys',
  keyPrefix: 'sk-ant-',

  async listModels(creds, signal) {
    const out = []
    for await (const m of client(creds).models.list({}, { signal })) {
      out.push({ id: m.id, name: m.display_name })
    }
    return out
  },

  async complete(creds, model, system, prompt, signal) {
    // Streaming avoids HTTP timeouts while the model thinks; we only need the final message.
    const msg = await client(creds)
      .messages.stream(
        { model, max_tokens: 16000, system, messages: [{ role: 'user', content: prompt }] },
        { signal },
      )
      .finalMessage()
    const u = msg.usage
    return {
      text: msg.content.map((b) => (b.type === 'text' ? b.text : '')).join(''),
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      costUsd: cost(
        model,
        u.input_tokens,
        u.output_tokens,
        u.cache_creation_input_tokens ?? 0,
        u.cache_read_input_tokens ?? 0,
      ),
    }
  },
}
