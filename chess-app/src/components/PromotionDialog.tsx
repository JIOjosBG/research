const PIECES = [
  ['q', '♛', 'Queen'],
  ['r', '♜', 'Rook'],
  ['b', '♝', 'Bishop'],
  ['n', '♞', 'Knight'],
] as const

export function PromotionDialog({ color, onPick }: { color: 'white' | 'black'; onPick: (p: string | null) => void }) {
  return (
    <div className="overlay" onMouseDown={() => onPick(null)}>
      <div className="dialog promo" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Promote pawn to</h3>
        <div className="promo-row">
          {PIECES.map(([k, glyph, name]) => (
            <button key={k} className={`promo-piece ${color}`} onClick={() => onPick(k)} title={name}>
              {glyph}
              <small>{name}</small>
            </button>
          ))}
        </div>
        <button className="ghost" onClick={() => onPick(null)}>Cancel</button>
      </div>
    </div>
  )
}
