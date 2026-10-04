import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { buildPrompt, chooseMove, MoveError, parseMove } from './llm'
import { cost, priceFor } from './pricing'
import { summarize, gameResult, type CostEntry } from './game'
import type { Provider } from './providers'

describe('parseMove', () => {
  const start = new Chess()
  it('reads UCI on the last line', () => expect(parseMove(start, 'I like it.\ne2e4')?.san).toBe('e4'))
  it('reads SAN', () => expect(parseMove(start, 'My move: Nf3')?.lan).toBe('g1f3'))
  it('ignores illegal moves', () => expect(parseMove(start, 'e2e5')).toBeNull())
  it('reads promotion', () => {
    const c = new Chess('8/P7/8/8/8/8/8/k6K w - - 0 1')
    expect(parseMove(c, 'a7a8n')?.promotion).toBe('n')
    expect(parseMove(c, '**a8=Q+**')?.promotion).toBe('q')
  })
  it('lists legal moves in the prompt', () => expect(buildPrompt(start)).toContain('e2e4'))
})

describe('pricing', () => {
  it('matches dated snapshots', () => expect(priceFor('gpt-5.4-2026-03-05')).toEqual([2.5, 15]))
  it('prefers the longest key', () => expect(priceFor('claude-opus-5-5')).toEqual([4, 20]))
  it('unknown model', () => expect(cost('mystery', 1, 1)).toBeNull())
  it('computes cost', () => expect(cost('claude-sonnet-5-5', 1000, 100)).toBeCloseTo(0.003))
})

const fake = (replies: string[], price: number | null = 0.01): Provider => ({
  id: 'openai', label: 'Fake', badge: 'F', keyUrl: '', keyPrefix: '',
  listModels: async () => [],
  complete: async () => ({ text: replies.shift()!, inputTokens: 10, outputTokens: 5, costUsd: price }),
})

describe('chooseMove', () => {
  it('retries an illegal reply and sums usage', async () => {
    const { move, usage } = await chooseMove(fake(['zzz', 'e2e4']), { apiKey: 'k' }, 'm', new Chess())
    expect(move.san).toBe('e4')
    expect(usage).toEqual({ requests: 2, inputTokens: 20, outputTokens: 10, costUsd: 0.02 })
  })
  it('fails after 3 tries with usage', async () => {
    const err = await chooseMove(fake(['a', 'b', 'c']), { apiKey: 'k' }, 'm', new Chess()).catch((e) => e)
    expect(err).toBeInstanceOf(MoveError)
    expect(err.usage.requests).toBe(3)
  })
  it('unknown price makes the move cost null', async () => {
    const { usage } = await chooseMove(fake(['e2e4'], null), { apiKey: 'k' }, 'm', new Chess())
    expect(usage.costUsd).toBeNull()
  })
})

describe('game', () => {
  it('summarize marks unknown prices', () => {
    const e = (costUsd: number | null) => ({ costUsd, inputTokens: 1, outputTokens: 1, requests: 1 }) as CostEntry
    expect(summarize([e(0.5), e(null)])).toMatchObject({ costUsd: 0.5, unknownPrice: true, moves: 2 })
  })
  it('detects checkmate', () => {
    const c = new Chess()
    for (const m of ['f3', 'e5', 'g4', 'Qh4#']) c.move(m)
    expect(gameResult(c)).toEqual({ result: '0-1', reason: 'Checkmate, Black wins' })
  })
})
