import { summarize, usd, usdSum, type CostEntry, type PlayerSpec } from '../game'

interface Props {
  costs: CostEntry[]
  players: { white: PlayerSpec; black: PlayerSpec }
  modelName: (p: PlayerSpec) => string
}

export function CostPanel({ costs, players, modelName }: Props) {
  const total = summarize(costs)
  const sides = (['white', 'black'] as const).filter((c) => players[c].kind === 'ai')
  if (!sides.length) return null
  return (
    <section className="card">
      <div className="card-title">
        <h3>API cost</h3>
        <span className="muted small">estimate from list prices</span>
      </div>
      <div className="total">
        <span className="muted">Total so far</span>
        <b>{usdSum(total)}</b>
      </div>
      <div className="side-costs">
        {sides.map((c) => {
          const s = summarize(costs.filter((x) => x.color === c))
          return (
            <div key={c} className="side-cost">
              <span className={`dot ${c}`} />
              <span className="grow ellipsis" title={modelName(players[c])}>{modelName(players[c])}</span>
              <span className="muted small">{(s.inputTokens + s.outputTokens).toLocaleString()} tok</span>
              <b>{usdSum(s)}</b>
            </div>
          )
        })}
      </div>
      {costs.length > 0 && (
        <div className="cost-log">
          <table>
            <thead>
              <tr><th>Move</th><th>Tokens in / out</th><th>Cost</th><th>Total</th></tr>
            </thead>
            <tbody>
              {[...costs].reverse().map((x, i) => (
                <tr key={i} className={x.san ? '' : 'failed'}>
                  <td>
                    {Math.floor(x.ply / 2) + 1}{x.color === 'white' ? '.' : '…'} {x.san ?? 'failed'}
                    {x.requests > 1 && <span className="muted small"> ×{x.requests}</span>}
                  </td>
                  <td>{x.inputTokens.toLocaleString()} / {x.outputTokens.toLocaleString()}</td>
                  <td>{usd(x.costUsd)}</td>
                  <td>{usd(x.totalSoFar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total.unknownPrice && (
        <p className="muted small">≥ means some models have no price in src/pricing.ts, so the real cost is higher.</p>
      )}
    </section>
  )
}
