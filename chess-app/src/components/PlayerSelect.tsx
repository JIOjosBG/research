import { PROVIDER_IDS, PROVIDERS, type ProviderId } from '../providers'
import type { PlayerSpec } from '../game'
import type { ModelState } from '../App'

interface Props {
  label: string
  value: PlayerSpec
  models: Record<ProviderId, ModelState>
  onChange: (p: PlayerSpec) => void
  disabled?: boolean
}

const encode = (p: PlayerSpec) => (p.kind === 'human' ? 'human' : `${p.provider}|${p.model}`)

export function PlayerSelect({ label, value, models, onChange, disabled }: Props) {
  return (
    <label className="player-select">
      <span>{label}</span>
      <select
        value={encode(value)}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value
          if (v === 'human') return onChange({ kind: 'human' })
          const [provider, ...rest] = v.split('|')
          onChange({ kind: 'ai', provider: provider as ProviderId, model: rest.join('|') })
        }}
      >
        <option value="human">🧑 Human</option>
        {PROVIDER_IDS.map((id) => {
          const m = models[id]
          const p = PROVIDERS[id]
          return (
            <optgroup key={id} label={p.label}>
              {m.status !== 'ok' && (
                <option disabled value="">
                  {m.status === 'loading' ? 'Loading models…' : 'Add an API key to play'}
                </option>
              )}
              {m.models.map((model) => (
                <option key={model.id} value={`${id}|${model.id}`}>
                  {model.name.startsWith(p.label) ? model.name : `${p.label} · ${model.name}`}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
