export type Limit = { name: string; pct: number; reset: string; burn: string }
export type Snap = {
  model: string
  effort: string
  branch: string
  dirty: boolean
  ctx: number | null
  limits: Limit[]
  cost: string
  saved: string
  turnStart: number
  tick: number
  lastTurn: number
  pr: { num: number; state: string; checks: string; review: string; url: string; canMerge: boolean } | null
  mergeAsk: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'statusline-plus': { snap: Snap | null }
  }
}
