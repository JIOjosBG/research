import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { PROVIDER_IDS, PROVIDERS, type ModelInfo, type ProviderId } from './providers'
import { chooseMove, errorText, MoveError } from './llm'
import { loadCreds, saveCreds, type CredsMap } from './keys'
import { gameResult, summarize, turnColor, usdSum, type Color, type CostEntry, type PlayerSpec } from './game'
import { KeysDialog } from './components/KeysDialog'
import { PlayerSelect } from './components/PlayerSelect'
import { PromotionDialog } from './components/PromotionDialog'
import { CostPanel } from './components/CostPanel'
import { GameOverDialog } from './components/GameOverDialog'

export interface ModelState {
  status: 'idle' | 'loading' | 'ok' | 'error'
  models: ModelInfo[]
  error?: string
}

type Status = 'setup' | 'playing' | 'paused' | 'over'
type Players = Record<Color, PlayerSpec>

const HUMAN: PlayerSpec = { kind: 'human' }
const emptyModels = () =>
  Object.fromEntries(PROVIDER_IDS.map((id) => [id, { status: 'idle', models: [] }])) as unknown as Record<
    ProviderId,
    ModelState
  >

export default function App() {
  const initial = useMemo(loadCreds, [])
  const [creds, setCreds] = useState<CredsMap>(initial.creds)
  const [remember, setRemember] = useState(initial.remember)
  const [models, setModels] = useState(emptyModels)
  const [showKeys, setShowKeys] = useState(false)

  const [setup, setSetup] = useState<Players>({ white: HUMAN, black: HUMAN })
  const [players, setPlayers] = useState<Players>({ white: HUMAN, black: HUMAN })
  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(chessRef.current.fen())
  const [status, setStatus] = useState<Status>('setup')
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [thinking, setThinking] = useState<Color | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Square | null>(null)
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [showOver, setShowOver] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const gameId = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  // "gameId:ply" of the AI request in flight, so one position is never requested twice
  // (React StrictMode runs effects twice in development).
  const requested = useRef<string | null>(null)

  const chess = chessRef.current
  const turn = turnColor(chess)
  const result = gameResult(chess)
  const history = chess.history({ verbose: true })
  const lastMove = history[history.length - 1]

  // ---- model lists -------------------------------------------------------
  const loadModels = useCallback(async (c: CredsMap) => {
    await Promise.all(
      PROVIDER_IDS.map(async (id) => {
        const cr = c[id]
        if (!cr?.apiKey) {
          setModels((m) => ({ ...m, [id]: { status: 'idle', models: [] } }))
          return
        }
        setModels((m) => ({ ...m, [id]: { ...m[id], status: 'loading' } }))
        try {
          const list = await PROVIDERS[id].listModels(cr)
          setModels((m) => ({ ...m, [id]: { status: 'ok', models: list } }))
        } catch (e) {
          setModels((m) => ({ ...m, [id]: { status: 'error', models: [], error: errorText(e, PROVIDERS[id].label) } }))
        }
      }),
    )
  }, [])

  useEffect(() => {
    loadModels(initial.creds)
  }, [initial, loadModels])

  const modelName = useCallback(
    (p: PlayerSpec) => {
      if (p.kind === 'human') return 'Human'
      return models[p.provider].models.find((m) => m.id === p.model)?.name ?? p.model
    },
    [models],
  )

  // ---- game flow ---------------------------------------------------------
  const sync = () => setFen(chess.fen())

  function newGame() {
    abortRef.current?.abort()
    gameId.current++
    chessRef.current = new Chess()
    setPlayers(setup)
    setCosts([])
    setError(null)
    setSelected(null)
    setThinking(null)
    setShowOver(false)
    setFlipped(setup.white.kind === 'ai' && setup.black.kind === 'human')
    setStatus('playing')
    setFen(chessRef.current.fen())
  }

  function afterMove() {
    sync()
    setSelected(null)
    if (chessRef.current.isGameOver()) {
      setStatus('over')
      setShowOver(true)
    }
  }

  // AI turn: runs whenever the position changes and the side to move is an AI.
  useEffect(() => {
    const spec = players[turn]
    if (status !== 'playing' || chess.isGameOver() || spec.kind !== 'ai') return
    const cr = creds[spec.provider]
    if (!cr?.apiKey) {
      setError(`No ${PROVIDERS[spec.provider].label} API key. Add it under API keys, then press Resume.`)
      setStatus('paused')
      return
    }
    const id = gameId.current
    const ply = chess.history().length
    if (requested.current === `${id}:${ply}`) return
    requested.current = `${id}:${ply}`
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const record = (san: string | null, u: { requests: number; inputTokens: number; outputTokens: number; costUsd: number | null }) =>
      setCosts((cs) => {
        const entry: CostEntry = { ply, color: turn, san, provider: spec.provider, model: spec.model, ...u, totalSoFar: 0 }
        entry.totalSoFar = summarize([...cs, entry]).costUsd
        return [...cs, entry]
      })

    setThinking(turn)
    setError(null)
    chooseMove(PROVIDERS[spec.provider], cr, spec.model, chess, ctrl.signal)
      .then(({ move, usage }) => {
        if (id !== gameId.current) return
        record(move.san, usage)
        chessRef.current.move(move.lan)
        afterMove()
      })
      .catch((e) => {
        if (id !== gameId.current || ctrl.signal.aborted) return
        requested.current = null // allow Resume to retry this position
        if (e instanceof MoveError && e.usage.requests > 0) record(null, e.usage)
        setError(e instanceof Error ? e.message : String(e))
        setStatus('paused')
      })
      .finally(() => {
        if (id === gameId.current) setThinking(null)
      })
    // Re-run only when the position or play state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, status, players])

  // ---- human moves -------------------------------------------------------
  const humanTurn = status === 'playing' && players[turn].kind === 'human' && !thinking

  function tryMove(from: Square, to: Square): boolean {
    if (!humanTurn) return false
    const legal = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to)
    if (!legal.length) return false
    if (legal.some((m) => m.promotion)) {
      setPromotion({ from, to })
      return false
    }
    chess.move({ from, to })
    afterMove()
    return true
  }

  function onSquareClick(square: Square) {
    if (!humanTurn) return
    if (selected && selected !== square && tryMove(selected, square)) return
    if (promotion) return
    const piece = chess.get(square)
    setSelected(piece && piece.color === chess.turn() && square !== selected ? square : null)
  }

  // ---- board styling -----------------------------------------------------
  const squareStyles: Record<string, CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = { background: 'rgba(255, 214, 10, 0.38)' }
    squareStyles[lastMove.to] = { background: 'rgba(255, 214, 10, 0.5)' }
  }
  if (chess.inCheck()) {
    const king = chess.board().flat().find((p) => p && p.type === 'k' && p.color === chess.turn())
    if (king) squareStyles[king.square] = { background: 'radial-gradient(circle, #ff4d4f 30%, rgba(255,77,79,0.25) 75%)' }
  }
  if (selected) {
    squareStyles[selected] = { background: 'rgba(76, 154, 255, 0.55)' }
    for (const m of chess.moves({ square: selected, verbose: true })) {
      squareStyles[m.to] = m.captured
        ? { background: 'radial-gradient(circle, transparent 58%, rgba(20,20,40,0.35) 60%)' }
        : { background: 'radial-gradient(circle, rgba(20,20,40,0.35) 22%, transparent 24%)' }
    }
  }

  // ---- render ------------------------------------------------------------
  const connected = PROVIDER_IDS.filter((id) => models[id].status === 'ok')
  const playing = status === 'playing' || status === 'paused'
  const movePairs: [string, string | undefined][] = []
  const sans = chess.history()
  for (let i = 0; i < sans.length; i += 2) movePairs.push([sans[i], sans[i + 1]])

  const top: Color = flipped ? 'white' : 'black'
  const bottom: Color = flipped ? 'black' : 'white'

  const playerBar = (c: Color) => {
    const p = players[c]
    const s = summarize(costs.filter((x) => x.color === c))
    return (
      <div className={`player-bar ${turn === c && playing ? 'active' : ''}`}>
        <span className={`dot ${c}`} />
        <span className="grow ellipsis">
          <b>{modelName(p)}</b>
          {p.kind === 'ai' && <span className="muted small"> · {PROVIDERS[p.provider].label}</span>}
        </span>
        {thinking === c && <span className="thinking">thinking<i>.</i><i>.</i><i>.</i></span>}
        {p.kind === 'ai' && s.moves > 0 && <span className="cost-chip">{usdSum(s)}</span>}
      </div>
    )
  }

  let statusText = 'Choose players and press Start'
  if (result) statusText = `${result.result} · ${result.reason}`
  else if (status === 'paused') statusText = 'Paused'
  else if (status === 'playing')
    statusText = thinking ? `${modelName(players[turn])} is thinking…` : `${turn === 'white' ? 'White' : 'Black'} to move${chess.inCheck() ? ' · check!' : ''}`

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="brand-icon">♞</span> LLM Chess
        </div>
        <div className="header-right">
          {connected.map((id) => (
            <span key={id} className={`logo logo-${id}`} title={`${PROVIDERS[id].label} connected`}>
              {PROVIDERS[id].badge}
            </span>
          ))}
          <button className="ghost" onClick={() => setShowKeys(true)}>
            {connected.length ? 'API keys' : 'Connect AI accounts'}
          </button>
        </div>
      </header>

      <main>
        <section className="board-col">
          {playerBar(top)}
          <div className="board-wrap">
            <Chessboard
              options={{
                id: 'main',
                position: fen,
                boardOrientation: flipped ? 'black' : 'white',
                squareStyles,
                allowDragging: humanTurn,
                canDragPiece: ({ piece }) => humanTurn && piece.pieceType[0] === chess.turn(),
                onPieceDrop: ({ sourceSquare, targetSquare }) =>
                  targetSquare ? tryMove(sourceSquare as Square, targetSquare as Square) : false,
                onSquareClick: ({ square }) => onSquareClick(square as Square),
                darkSquareStyle: { backgroundColor: '#7a94b8' },
                lightSquareStyle: { backgroundColor: '#e3e9f2' },
                boardStyle: { borderRadius: 10, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.45)' },
                animationDurationInMs: 250,
              }}
            />
          </div>
          {playerBar(bottom)}
        </section>

        <aside>
          <section className="card">
            <div className="card-title">
              <h3>Game</h3>
              <button className="icon" title="Flip board" onClick={() => setFlipped((f) => !f)}>⇅</button>
            </div>
            <PlayerSelect label="White" value={setup.white} models={models} onChange={(p) => setSetup((s) => ({ ...s, white: p }))} />
            <PlayerSelect label="Black" value={setup.black} models={models} onChange={(p) => setSetup((s) => ({ ...s, black: p }))} />
            <div className="buttons">
              <button className="primary" onClick={newGame}>{playing ? 'Restart' : 'Start game'}</button>
              {status === 'playing' && (players.white.kind === 'ai' || players.black.kind === 'ai') && (
                <button className="ghost" onClick={() => setStatus('paused')} title="Stops after the current move">Pause</button>
              )}
              {status === 'paused' && <button className="ghost" onClick={() => { setError(null); setStatus('playing') }}>Resume</button>}
            </div>
            <div className={`status ${result ? 'done' : ''}`}>{statusText}</div>
            {error && <div className="error">{error}</div>}
            {!connected.length && (
              <p className="muted small">
                Two humans can play right away. To play against Claude, ChatGPT or Grok,{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setShowKeys(true) }}>connect an AI account</a>.
              </p>
            )}
          </section>

          <section className="card">
            <h3>Moves</h3>
            <div className="moves">
              {movePairs.length === 0 && <span className="muted small">No moves yet</span>}
              {movePairs.map(([w, b], i) => (
                <div key={i} className="move-row">
                  <span className="muted">{i + 1}.</span>
                  <span>{w}</span>
                  <span>{b ?? ''}</span>
                </div>
              ))}
            </div>
          </section>

          <CostPanel costs={costs} players={players} modelName={modelName} />
        </aside>
      </main>

      {showKeys && (
        <KeysDialog
          creds={creds}
          remember={remember}
          models={models}
          onClose={() => setShowKeys(false)}
          onSave={(c, keep) => {
            setCreds(c)
            setRemember(keep)
            saveCreds(c, keep)
            loadModels(c)
            setShowKeys(false)
          }}
        />
      )}
      {promotion && (
        <PromotionDialog
          color={turn}
          onPick={(piece) => {
            const p = promotion
            setPromotion(null)
            if (!piece) return setSelected(null)
            chess.move({ from: p.from, to: p.to, promotion: piece })
            afterMove()
          }}
        />
      )}
      {showOver && result && (
        <GameOverDialog result={result} costs={costs} moves={history.length} onNewGame={newGame} onClose={() => setShowOver(false)} />
      )}
    </div>
  )
}
