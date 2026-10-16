import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, Snap } from '../types'

const snapAtom = atom({ plugin: 'statusline-plus', key: 'snap' } as const, null)

const PR_URL = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/
const PR_CMD = /\bgh\s+pr\s+(create|view|merge|close|reopen|ready)\b/
const GIT_CMD = /\bgit\s+(checkout|switch|commit|add|reset|stash|merge|rebase|pull|restore|branch)\b/
const POLL_MS = 30_000
const FIVE_H = 5 * 3600_000
const BAR = 12

// Gruvbox Material-ish palette
const C = {
  green: '#a9b665',
  yellow: '#d8a657',
  red: '#ea6962',
  blue: '#7daea3',
  purple: '#d3869b',
  aqua: '#89b482',
  orange: '#e78a4e',
  fg: '#d4be98',
  mute: '#928374',
  track: '#504945',
}

type PrState = { url: string; num?: number; state?: string; draft?: boolean; checks?: string; review?: string }
type Ledger = Record<string, number>

let pr: PrState | undefined
let planPrice = 0
let ctx: number | null = null
let limits: Limit[] = []
let cost = ''
let saved = ''
let branch = ''
let dirty = false
let model = ''
let effort = ''
let turnStart = 0
let tick = 0
let lastTurn = -1
let ticker: any
let ctxWarned = false
let mergeAsk = false
const warnedLimits: Record<string, boolean> = {}

function dur(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000))
  if (m >= 1440) return `${Math.floor(m / 1440)}d${Math.floor((m % 1440) / 60)}h`
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60}m`
  return `${m}m`
}

function money(n: number): string {
  return n < 100 ? n.toFixed(2) : n.toFixed(0)
}

function dayKey(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function level(pct: number): string {
  return pct >= 90 ? C.red : pct >= 70 ? C.yellow : C.green
}

function snapshot(): Snap {
  return {
    model,
    effort,
    branch,
    dirty,
    ctx,
    limits,
    cost,
    saved,
    turnStart,
    tick,
    lastTurn,
    pr:
      pr && pr.state
        ? {
            num: pr.num ?? 0,
            state: pr.draft && pr.state === 'OPEN' ? 'DRAFT' : pr.state,
            checks: pr.checks ?? '',
            review: pr.review ?? '',
            url: pr.url,
            canMerge:
              pr.state === 'OPEN' && !pr.draft && pr.checks !== '✗ci' && pr.checks !== '…ci' && pr.review !== '✗chg',
          }
        : null,
    mergeAsk,
  }
}

function render($: any): void {
  tick += 1
  void update($, snapAtom, () => snapshot())
}

function meter(Text: any, key: string, label: string, pct: number, tail: string) {
  const p = Math.max(0, Math.min(100, pct))
  const filled = Math.round((p / 100) * BAR)
  const col = level(p)
  return (
    <Text key={key}>
      <Text color={C.mute}>{label} </Text>
      <Text color={col}>{'━'.repeat(filled)}</Text>
      <Text color={C.track}>{'─'.repeat(BAR - filled)}</Text>
      <Text color={col} bold>{` ${Math.round(p)}%`}</Text>
      <Text color={C.mute}>{tail}</Text>
      <Text>{'   '}</Text>
    </Text>
  )
}

function prView(Text: any, s: Snap) {
  if (!s.pr) return null
  const st = s.pr.state
  const col = st === 'MERGED' ? C.purple : st === 'CLOSED' ? C.red : st === 'DRAFT' ? C.mute : C.green
  const ci = s.pr.checks === '✓ci' ? C.green : s.pr.checks === '✗ci' ? C.red : C.yellow
  return (
    <Text key="pr">
      <Text color={col} bold>{`● #${s.pr.num} ${st.toLowerCase()}`}</Text>
      {s.pr.checks ? <Text color={ci}>{` ${s.pr.checks}`}</Text> : null}
      {s.pr.review ? <Text color={s.pr.review === '✓appr' ? C.green : C.red}>{` ${s.pr.review}`}</Text> : null}
      <Text>{'   '}</Text>
    </Text>
  )
}

async function refreshGit($: any): Promise<void> {
  try {
    const b = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 5000 })
    if (b.exitCode !== 0) {
      branch = ''
      return
    }
    const s = await $.process.run(['git', 'status', '--porcelain'], { timeoutMs: 5000 })
    branch = b.stdout.trim()
    dirty = s.exitCode === 0 && s.stdout.trim() !== ''
  } catch {
    branch = ''
  }
}

async function refreshPr($: any): Promise<void> {
  if (!pr) return
  try {
    const r = await $.process.run(
      ['gh', 'pr', 'view', pr.url, '--json', 'number,state,isDraft,reviewDecision,statusCheckRollup'],
      { timeoutMs: 15000 },
    )
    if (r.exitCode !== 0) return
    const j = JSON.parse(r.stdout)
    const rollup: any[] = j.statusCheckRollup ?? []
    const bad = rollup.some(c => ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED'].includes(c.conclusion ?? c.state))
    const pending = rollup.some(c => (c.status && c.status !== 'COMPLETED') || c.state === 'PENDING')
    const prev = pr
    const next: PrState = {
      url: pr.url,
      num: j.number,
      state: j.state,
      draft: j.isDraft,
      checks: rollup.length ? (bad ? '✗ci' : pending ? '…ci' : '✓ci') : '',
      review: j.reviewDecision === 'APPROVED' ? '✓appr' : j.reviewDecision === 'CHANGES_REQUESTED' ? '✗chg' : '',
    }
    pr = next
    if (prev.state && prev.state !== next.state) {
      $.ui.toast(`PR #${next.num} ${String(next.state).toLowerCase()}`, { timeoutMs: 8000 })
    } else if (prev.state === 'OPEN' && prev.checks && prev.checks !== next.checks) {
      if (next.checks === '✗ci') $.ui.toast(`PR #${next.num}: CI failed`, { timeoutMs: 8000 })
      if (next.checks === '✓ci') $.ui.toast(`PR #${next.num}: CI passed`, { timeoutMs: 8000 })
    }
    render($)
  } catch {
    // keep last known
  }
}

async function track($: any, usd: number, startedAt: number): Promise<{ today: number; month: number }> {
  const now = Date.now()
  const today = dayKey(now)
  const sessKey = `sess:${startedAt}`
  const last = Number((await $.store.get(sessKey)) ?? 0)
  const ledger: Ledger = ((await $.store.get('ledger')) as Ledger | undefined) ?? {}
  if (usd > last) {
    ledger[today] = (ledger[today] ?? 0) + (usd - last)
    await $.store.set(sessKey, usd)
    for (const k of Object.keys(ledger)) {
      if (now - Date.parse(k) > 70 * 86400_000) delete ledger[k]
    }
    await $.store.set('ledger', ledger)
  }
  const monthPrefix = today.slice(0, 7)
  let month = 0
  for (const k of Object.keys(ledger)) if (k.startsWith(monthPrefix)) month += ledger[k] ?? 0
  return { today: ledger[today] ?? 0, month }
}

async function refreshUsage($: any): Promise<void> {
  const u = await $.session.usage()
  const now = Date.now()

  if (u.context.percent !== undefined) {
    const r = Math.round(u.context.percent)
    ctx = r
    if (r >= 85 && !ctxWarned) {
      ctxWarned = true
      $.ui.toast(`Context ${r}% full: consider /compact`, { timeoutMs: 8000 })
    } else if (r < 70) {
      ctxWarned = false
    }
  }

  const next: Limit[] = []
  for (const l of u.rateLimits) {
    const name = l.kind === 'five_hour' ? '5h' : l.kind === 'seven_day' ? '7d' : l.kind
    const p = Math.round(l.percentUsed)
    const resetMs = l.resetsAt ? Date.parse(l.resetsAt) : 0
    let burn = ''
    if (l.kind === 'five_hour' && resetMs && l.percentUsed > 0) {
      const elapsed = now - (resetMs - FIVE_H)
      if (elapsed > 5 * 60000) {
        const toFull = ((100 - l.percentUsed) / l.percentUsed) * elapsed
        if (toFull > 0 && now + toFull < resetMs) burn = `full in ${dur(toFull)}`
      }
    }
    next.push({ name, pct: l.percentUsed, reset: resetMs ? dur(resetMs - now) : '', burn })
    const wkey = `${l.kind}:${l.resetsAt ?? ''}`
    if (p >= 90 && !warnedLimits[wkey]) {
      warnedLimits[wkey] = true
      $.ui.toast(`${name} limit at ${p}%`, { timeoutMs: 8000 })
    }
  }
  limits = next

  const usd = u.cost?.usd ?? 0
  const t = await track($, usd, u.startedAt)
  cost = `$${usd.toFixed(2)} session · $${money(t.today)} today · $${money(t.month)} month`
  const d = t.month - planPrice
  saved = planPrice > 0 && d > 0 ? `saved $${money(d)}` : ''
  render($)
}

async function refreshModel($: any): Promise<void> {
  try {
    model = String(await $.session.model())
      .replace(/^claude-/, '')
      .replace(/-\d{8}$/, '')
  } catch {
    // keep last
  }
}

async function openPr($: any): Promise<void> {
  if (!pr) return
  await $.process.run(['open', pr.url], { timeoutMs: 5000 })
}

async function fixCi($: any): Promise<void> {
  if (!pr) return
  await $.prompt.submit({
    text: `CI is failing on ${pr.url}. Inspect it (gh pr checks, gh run view --log-failed), fix the cause, and push.`,
    asUser: true,
  })
}

function askMerge($: any): void {
  mergeAsk = true
  render($)
  $.clock.after(10_000, () => {
    mergeAsk = false
    render($)
  })
}

function cancelMerge($: any): void {
  mergeAsk = false
  render($)
}

async function doMerge($: any): Promise<void> {
  mergeAsk = false
  if (!pr) return
  const r = await $.process.run(['gh', 'pr', 'merge', pr.url, '--merge'], { timeoutMs: 60000 })
  $.ui.toast(r.exitCode === 0 ? `PR #${pr.num} merged` : `Merge failed: ${String(r.stderr).trim().slice(0, 120)}`, {
    timeoutMs: 8000,
  })
  await refreshPr($)
  render($)
}

async function refreshAll($: any): Promise<void> {
  await refreshModel($)
  await refreshGit($)
  await refreshUsage($)
  await refreshPr($)
  $.ui.toast('Refreshed', { timeoutMs: 1500 })
}

function stopTicker(): void {
  if (ticker) ticker.cancel()
  ticker = undefined
}

export const register: Register = (on, options) => {
  planPrice = Number(options.planPriceUsd ?? 0)

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    try {
      const v = await $.process.run(['gh', 'pr', 'view', '--json', 'url,state'], { timeoutMs: 15000 })
      if (v.exitCode === 0) {
        const j = JSON.parse(v.stdout)
        if (j.state === 'OPEN') pr = { url: j.url }
      }
    } catch {
      // no PR for this branch
    }
    await refreshModel($)
    await refreshGit($)
    await refreshUsage($)
    await refreshPr($)
    $.clock.every(POLL_MS, () => {
      void refreshGit($).then(() => refreshPr($)).then(() => render($))
    })
    return r
  })

  on('session.measure', async ($, e, next) => {
    await refreshModel($)
    await refreshUsage($)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      turnStart = Date.now()
      stopTicker()
      ticker = $.clock.every(1000, () => render($))
      render($)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      stopTicker()
      turnStart = 0
      lastTurn = Math.round(e.durationMs / 1000)
      render($)
    }
    return next(e)
  })

  on('classic.PostToolUse', async ($, e, next) => {
    const lvl = (e as any).effort?.level
    if (lvl && lvl !== effort) {
      effort = lvl
      render($)
    }
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    if (GIT_CMD.test(e.command)) {
      await refreshGit($)
      render($)
    }
    if (PR_CMD.test(e.command)) {
      const hit = JSON.stringify(ran.result ?? '').match(PR_URL)
      if (hit && hit[0] !== pr?.url) pr = { url: hit[0] }
      if (pr) {
        render($)
        void refreshPr($)
      }
    }
    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snapAtom)
    if (!s || e.props.hasSurvey) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const turn = s.turnStart
      ? `⏱ ${Math.round((Date.now() - s.turnStart) / 1000)}s`
      : s.lastTurn >= 0
        ? `last ${s.lastTurn}s`
        : ''

    const top = [
      s.model ? (
        <Text key="m" color={C.blue} bold>
          {`◆ ${s.model}`}
          {s.effort ? <Text color={C.aqua}>{` ${s.effort}`}</Text> : null}
          <Text>{'   '}</Text>
        </Text>
      ) : null,
      s.branch ? (
        <Text key="g" color={C.orange}>
          {` ${s.branch}`}
          {s.dirty ? <Text color={C.yellow}>{' ●'}</Text> : null}
          <Text>{'   '}</Text>
        </Text>
      ) : null,
      prView(Text, s),
      s.pr ? <Button key="open" plain hotkey="o" label="open" onPress={() => void openPr($)} /> : null,
      s.pr && s.pr.checks === '✗ci' ? (
        <Button key="fix" plain hotkey="f" label="fix CI" onPress={() => void fixCi($)} />
      ) : null,
      s.pr && s.pr.canMerge && !s.mergeAsk ? (
        <Button key="merge" plain hotkey="m" label="merge" onPress={() => askMerge($)} />
      ) : null,
      s.pr && s.mergeAsk ? (
        <Text key="ask" color={C.yellow} bold>{`merge #${s.pr.num}? `}</Text>
      ) : null,
      s.pr && s.mergeAsk ? <Button key="yes" plain hotkey="y" label="yes" onPress={() => void doMerge($)} /> : null,
      s.pr && s.mergeAsk ? <Button key="no" plain hotkey="n" label="no" onPress={() => cancelMerge($)} /> : null,
      <Text key="sp">{'  '}</Text>,
      <Button key="refresh" plain hotkey="r" label="↻" onPress={() => void refreshAll($)} />,
      <Text key="sp2">{'   '}</Text>,
      turn ? (
        <Text key="t" color={s.turnStart ? C.purple : C.mute}>{turn}</Text>
      ) : null,
    ]

    const meters = []
    if (s.ctx !== null) {
      meters.push(meter(Text, 'ctx', 'ctx', s.ctx, s.ctx >= 85 ? ' compact?' : ''))
    }
    for (const l of s.limits) {
      const tail = [l.reset ? ` ↻${l.reset}` : '', l.burn ? ` 🔥${l.burn}` : ''].join('')
      meters.push(meter(Text, l.name, l.name, l.pct, tail))
    }

    return (
      <Box flexDirection="column">
        <Box flexWrap="wrap">{top}</Box>
        <Box flexWrap="wrap">{meters}</Box>
        {s.cost ? (
          <Text color={C.mute}>
            {'API-equiv  '}
            <Text color={C.fg}>{s.cost}</Text>
            {s.saved ? <Text color={s.saved.startsWith('saved') ? C.green : C.yellow} bold>{`  ${s.saved}`}</Text> : null}
          </Text>
        ) : null}
      </Box>
    )
  })
}
