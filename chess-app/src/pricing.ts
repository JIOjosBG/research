// List prices in USD per 1M tokens: model id -> [input, output].
// Prices change often: edit this table to match each company's pricing page.
// A key also matches dated snapshots ("gpt-5.4" matches "gpt-5.4-2026-03-05").
// Models not in the table show cost "n/a".
export const PRICES: Record<string, [number, number]> = {
  // Anthropic (thinking tokens are billed as output)
  'claude-fable-5-1': [10, 50],
  'claude-fable-5': [10, 50],
  'claude-opus-5-5': [4, 20],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-opus-4-7': [5, 25],
  'claude-opus-4-6': [5, 25],
  'claude-sonnet-5-5': [2, 10],
  'claude-sonnet-5': [2, 10],
  'claude-sonnet-4-6': [3, 15],
  'claude-haiku-4-5': [1, 5],
  // OpenAI (reasoning tokens are billed as output)
  'gpt-6-astra': [10, 50],
  'gpt-5.6-sol': [4, 20],
  'gpt-5.6-terra': [2, 12],
  'gpt-5.6-luna': [0.2, 1.2],
  'gpt-5.5': [5, 30],
  'gpt-5.4': [2.5, 15],
  // xAI
  'grok-4.7': [2, 6],
  'grok-4.6': [2, 6],
  'grok-4.5': [2, 6],
  'grok-4.3': [1.25, 2.5],
  'grok-4.20': [1.25, 2.5],
}

export function priceFor(model: string): [number, number] | null {
  let best: string | null = null
  for (const key of Object.keys(PRICES)) {
    if ((model === key || model.startsWith(key + '-')) && (!best || key.length > best.length)) best = key
  }
  return best ? PRICES[best] : null
}

export function cost(
  model: string,
  input: number,
  output: number,
  cacheWrite = 0,
  cacheRead = 0,
): number | null {
  const p = priceFor(model)
  if (!p) return null
  const [pin, pout] = p
  return (input * pin + cacheWrite * pin * 1.25 + cacheRead * pin * 0.1 + output * pout) / 1_000_000
}
