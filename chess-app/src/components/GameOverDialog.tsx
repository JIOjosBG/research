import { summarize, usdSum, type CostEntry } from '../game'

interface Props {
  result: { result: string; reason: string }
  costs: CostEntry[]
  moves: number
  onNewGame: () => void
  onClose: () => void
}

export function GameOverDialog({ result, costs, moves, onNewGame, onClose }: Props) {
  const total = summarize(costs)
  const byModel = new Map<string, CostEntry[]>()
  for (const c of costs) byModel.set(c.model, [...(byModel.get(c.model) ?? []), c])
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog over" onMouseDown={(e) => e.stopPropagation()}>
        <div className="result">{result.result}</div>
        <h2>{result.reason}</h2>
        <p className="muted">{Math.ceil(moves / 2)} moves</p>
        {costs.length > 0 && (
          <>
            <div className="total big">
              <span className="muted">Total API cost</span>
              <b>{usdSum(total)}</b>
            </div>
            <p className="muted small">
              {total.moves} AI moves · {total.requests} requests · {total.inputTokens.toLocaleString()} input +{' '}
              {total.outputTokens.toLocaleString()} output tokens
            </p>
            <table>
              <thead>
                <tr><th>Model</th><th>Moves</th><th>Tokens</th><th>Cost</th></tr>
              </thead>
              <tbody>
                {[...byModel].map(([model, list]) => {
                  const s = summarize(list)
                  return (
                    <tr key={model}>
                      <td>{model}</td>
                      <td>{s.moves}</td>
                      <td>{(s.inputTokens + s.outputTokens).toLocaleString()}</td>
                      <td>{usdSum(s)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
        <div className="actions">
          <button className="ghost" onClick={onClose}>Look at the board</button>
          <button className="primary" onClick={onNewGame}>New game</button>
        </div>
      </div>
    </div>
  )
}
