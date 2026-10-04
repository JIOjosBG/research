import { Chess, type Move } from 'chess.js'
import type { Provider, ProviderCreds } from './providers'

export const SYSTEM =
  'You are a strong chess player. You are given the current position and the list of legal moves. ' +
  'Reply with exactly one move from the legal list, in UCI notation (e.g. e2e4, g1f3, e7e8q), ' +
  'on the last line, with no other text after it.'

export const MAX_ATTEMPTS = 3

export function describePosition(chess: Chess): string {
  const color = chess.turn() === 'w' ? 'White' : 'Black'
  const pgn = chess
    .history()
    .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m))
    .join(' ')
  return `You play ${color}.\nFEN: ${chess.fen()}\nMoves so far: ${pgn || '(none)'}\n`
}

export function buildPrompt(chess: Chess, feedback?: string): string {
  const legal = chess.moves({ verbose: true }).map((m) => m.lan).join(' ')
  let text = describePosition(chess) + `Legal moves (UCI): ${legal}\n`
  if (feedback) text += `\nYour previous answer was rejected: ${feedback}\n`
  return text + '\nYour move (UCI):'
}

/** Takes the last token in the reply that is a legal move (UCI or SAN). */
export function parseMove(chess: Chess, text: string): Move | null {
  const legal = chess.moves({ verbose: true })
  const tokens = text.replace(/,/g, ' ').split(/\s+/).reverse()
  for (const raw of tokens) {
    const t = raw.replace(/^[.`*()"']+|[.`*()"']+$/g, '')
    if (!t) continue
    const uci = legal.find((m) => m.lan === t.toLowerCase())
    if (uci) return uci
    const san = legal.find((m) => m.san.replace(/[+#]/g, '') === t.replace(/[+#!?]/g, ''))
    if (san) return san
  }
  return null
}

export interface MoveUsage {
  requests: number
  inputTokens: number
  outputTokens: number
  costUsd: number | null
}

export class MoveError extends Error {
  constructor(message: string, readonly usage: MoveUsage) {
    super(message)
  }
}

/**
 * Asks the model for a move, retrying up to MAX_ATTEMPTS times on an illegal reply.
 * Usage covers every request, also when the move fails (a MoveError carries it).
 */
export async function chooseMove(
  provider: Provider,
  creds: ProviderCreds,
  model: string,
  chess: Chess,
  signal?: AbortSignal,
): Promise<{ move: Move; usage: MoveUsage }> {
  const usage: MoveUsage = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
  let feedback: string | undefined
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    let reply
    try {
      reply = await provider.complete(creds, model, SYSTEM, buildPrompt(chess, feedback), signal)
    } catch (e) {
      throw new MoveError(errorText(e, provider.label), usage)
    }
    usage.requests++
    usage.inputTokens += reply.inputTokens
    usage.outputTokens += reply.outputTokens
    usage.costUsd = usage.costUsd === null || reply.costUsd === null ? null : usage.costUsd + reply.costUsd
    const move = parseMove(chess, reply.text)
    if (move) return { move, usage }
    feedback = `no legal move found in your reply: ${JSON.stringify(reply.text.slice(-200))}`
  }
  throw new MoveError(`${model} did not give a legal move in ${MAX_ATTEMPTS} tries`, usage)
}

export function errorText(e: unknown, label: string): string {
  if (e instanceof Error && e.name === 'AbortError') return 'stopped'
  const msg = e instanceof Error ? e.message : String(e)
  // fetch() reports CORS and network failures only as "Failed to fetch".
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return `${label}: the browser could not reach the API (network or CORS). Check your connection, or set a proxy URL in API keys.`
  }
  return msg
}
