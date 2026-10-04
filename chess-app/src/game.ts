import type { Chess } from 'chess.js'
import type { ProviderId } from './providers'

export type Color = 'white' | 'black'

export type PlayerSpec = { kind: 'human' } | { kind: 'ai'; provider: ProviderId; model: string }

export interface CostEntry {
  ply: number
  color: Color
  san: string | null // null when the move failed
  provider: ProviderId
  model: string
  requests: number
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  totalSoFar: number
}

export interface CostSummary {
  costUsd: number
  /** true when some entry had no price, so costUsd is a lower bound */
  unknownPrice: boolean
  inputTokens: number
  outputTokens: number
  requests: number
  moves: number
}

export function summarize(entries: CostEntry[]): CostSummary {
  return {
    costUsd: entries.reduce((s, x) => s + (x.costUsd ?? 0), 0),
    unknownPrice: entries.some((x) => x.costUsd === null),
    inputTokens: entries.reduce((s, x) => s + x.inputTokens, 0),
    outputTokens: entries.reduce((s, x) => s + x.outputTokens, 0),
    requests: entries.reduce((s, x) => s + x.requests, 0),
    moves: entries.length,
  }
}

export function turnColor(chess: Chess): Color {
  return chess.turn() === 'w' ? 'white' : 'black'
}

export function gameResult(chess: Chess): { result: string; reason: string } | null {
  if (!chess.isGameOver()) return null
  if (chess.isCheckmate()) {
    return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: `Checkmate, ${chess.turn() === 'w' ? 'Black' : 'White'} wins` }
  }
  const reason = chess.isStalemate()
    ? 'Stalemate'
    : chess.isThreefoldRepetition()
      ? 'Threefold repetition'
      : chess.isInsufficientMaterial()
        ? 'Insufficient material'
        : 'Draw by the 50-move rule'
  return { result: '½-½', reason }
}

export const usd = (v: number | null) => (v === null ? 'n/a' : '$' + v.toFixed(v < 0.01 ? 5 : 4))
export const usdSum = (s: CostSummary) => (s.unknownPrice ? '≥ ' : '') + usd(s.costUsd)
