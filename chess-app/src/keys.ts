import type { ProviderCreds, ProviderId } from './providers'

// API keys stay in this browser. With "remember" on they are saved in
// localStorage; otherwise they live only in memory until the tab closes.
const STORAGE_KEY = 'llmchess.creds.v1'

export type CredsMap = Partial<Record<ProviderId, ProviderCreds>>

export function loadCreds(): { creds: CredsMap; remember: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { creds: JSON.parse(raw), remember: true }
  } catch {
    /* storage blocked or corrupt: start empty */
  }
  return { creds: {}, remember: false }
}

export function saveCreds(creds: CredsMap, remember: boolean) {
  try {
    if (remember) localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage blocked: keys stay in memory only */
  }
}
