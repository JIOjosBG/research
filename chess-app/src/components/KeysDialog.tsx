import { useState } from 'react'
import { PROVIDER_IDS, PROVIDERS, type ProviderId } from '../providers'
import type { CredsMap } from '../keys'
import type { ModelState } from '../App'

interface Props {
  creds: CredsMap
  remember: boolean
  models: Record<ProviderId, ModelState>
  onSave: (creds: CredsMap, remember: boolean) => void
  onClose: () => void
}

export function KeysDialog({ creds, remember, models, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<CredsMap>(structuredClone(creds))
  const [keep, setKeep] = useState(remember)
  const [show, setShow] = useState(false)

  const set = (id: ProviderId, field: 'apiKey' | 'baseUrl', value: string) =>
    setDraft((d) => ({ ...d, [id]: { apiKey: '', ...d[id], [field]: value.trim() } }))

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog keys" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Connect your AI accounts</h2>
        <p className="muted">
          Paste an API key for each company you want to play with. Moves are paid from your own account and
          limits. Keys stay in this browser and are sent only to that company's API.
        </p>
        {PROVIDER_IDS.map((id) => {
          const p = PROVIDERS[id]
          const m = models[id]
          return (
            <div className="key-row" key={id}>
              <div className="key-head">
                <span className={`logo logo-${id}`}>{p.badge}</span>
                <b>{p.label}</b>
                <span className={`pill ${m.status}`}>
                  {m.status === 'ok' ? `${m.models.length} models` : m.status === 'loading' ? 'checking…' : m.status === 'error' ? 'error' : 'not connected'}
                </span>
                <a href={p.keyUrl} target="_blank" rel="noreferrer">Get a key ↗</a>
              </div>
              <input
                type={show ? 'text' : 'password'}
                placeholder={`${p.keyPrefix}…`}
                value={draft[id]?.apiKey ?? ''}
                onChange={(e) => set(id, 'apiKey', e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              {m.status === 'error' && <div className="error small">{m.error}</div>}
              <details>
                <summary>Advanced: proxy URL</summary>
                <input
                  placeholder="Leave empty to call the API directly"
                  value={draft[id]?.baseUrl ?? ''}
                  onChange={(e) => set(id, 'baseUrl', e.target.value)}
                />
              </details>
            </div>
          )
        })}
        <label className="check">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show keys
        </label>
        <label className="check">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Remember keys on this
          device (do not use on a shared computer)
        </label>
        <div className="actions">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => onSave(draft, keep)}>Save and load models</button>
        </div>
      </div>
    </div>
  )
}
