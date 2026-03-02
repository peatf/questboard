export type Weekday =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'

export interface Targets {
  debt: number
  tracks: number
}

export interface QuestConfig {
  name: string
  day: Weekday
  time: string
  targets: Targets
  trusted: string
  midweek: boolean
  prep: boolean
}

export interface AppProgressState {
  targets: Targets
  current: {
    debt: number
    savings: number
    tracks: number
  }
  streakWeeks: number
}

export interface QuestboardState {
  config: QuestConfig
  appState: AppProgressState
  reminderSaved: boolean
}

export interface WeeklyLogEntry {
  debt: number
  savings: number
  tracks: number
}

export type WalkthroughTarget = 'log' | 'monthly' | 'calendar'

interface RankInfo {
  name: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  next: 'SILVER' | 'GOLD' | 'PLATINUM' | null
  nextAt: number | null
}

interface PaceInfo {
  label: 'AHEAD' | 'ON PACE' | 'BEHIND'
  className: 'good' | 'warn' | 'bad'
}

interface MonthInfo {
  daysInMonth: number
  dayIndex: number
  daysLeft: number
  expectedPct: number
}

const WEEKDAYS: Weekday[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export const STORAGE_KEY = 'questboard_v1'
export const WALKTHROUGH_DONE_KEY = 'questboard_wt_done'

const DEFAULT_CONFIG: QuestConfig = {
  name: 'Elias',
  day: 'Sunday',
  time: '19:00',
  targets: { debt: 800, tracks: 8 },
  trusted: '',
  midweek: true,
  prep: false,
}

const DEFAULT_APP_STATE: AppProgressState = {
  targets: { debt: 800, tracks: 8 },
  current: { debt: 200, savings: 150, tracks: 2 },
  streakWeeks: 4,
}

const DEFAULT_STATE: QuestboardState = {
  config: DEFAULT_CONFIG,
  appState: DEFAULT_APP_STATE,
  reminderSaved: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.round(value))
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') {
    return fallback
  }
  return value.trim()
}

function toWeekday(value: unknown): Weekday {
  if (typeof value === 'string' && WEEKDAYS.includes(value as Weekday)) {
    return value as Weekday
  }
  return DEFAULT_CONFIG.day
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  return fallback
}

function sanitizeTargets(value: unknown, fallback: Targets): Targets {
  if (!isRecord(value)) {
    return { ...fallback }
  }
  return {
    debt: clampNonNegative(Number(value.debt ?? fallback.debt)),
    tracks: clampNonNegative(Number(value.tracks ?? fallback.tracks)),
  }
}

function sanitizeConfig(value: unknown): QuestConfig {
  if (!isRecord(value)) {
    return { ...DEFAULT_CONFIG, targets: { ...DEFAULT_CONFIG.targets } }
  }

  return {
    name: toText(value.name, DEFAULT_CONFIG.name) || DEFAULT_CONFIG.name,
    day: toWeekday(value.day),
    time: toText(value.time, DEFAULT_CONFIG.time) || DEFAULT_CONFIG.time,
    targets: sanitizeTargets(value.targets, DEFAULT_CONFIG.targets),
    trusted: toText(value.trusted, ''),
    midweek: toBool(value.midweek, DEFAULT_CONFIG.midweek),
    prep: toBool(value.prep, DEFAULT_CONFIG.prep),
  }
}

function sanitizeAppState(value: unknown, fallbackTargets: Targets): AppProgressState {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_APP_STATE,
      targets: { ...fallbackTargets },
    }
  }

  const targets = sanitizeTargets(value.targets, fallbackTargets)
  const current = isRecord(value.current) ? value.current : {}

  return {
    targets,
    current: {
      debt: clampNonNegative(Number(current.debt ?? DEFAULT_APP_STATE.current.debt)),
      savings: clampNonNegative(Number(current.savings ?? DEFAULT_APP_STATE.current.savings)),
      tracks: clampNonNegative(Number(current.tracks ?? DEFAULT_APP_STATE.current.tracks)),
    },
    streakWeeks: clampNonNegative(Number(value.streakWeeks ?? DEFAULT_APP_STATE.streakWeeks)),
  }
}

export function loadQuestboardState(): QuestboardState {
  if (typeof window === 'undefined') {
    return {
      config: { ...DEFAULT_CONFIG, targets: { ...DEFAULT_CONFIG.targets } },
      appState: {
        ...DEFAULT_APP_STATE,
        targets: { ...DEFAULT_APP_STATE.targets },
        current: { ...DEFAULT_APP_STATE.current },
      },
      reminderSaved: DEFAULT_STATE.reminderSaved,
    }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        config: { ...DEFAULT_CONFIG, targets: { ...DEFAULT_CONFIG.targets } },
        appState: {
          ...DEFAULT_APP_STATE,
          targets: { ...DEFAULT_APP_STATE.targets },
          current: { ...DEFAULT_APP_STATE.current },
        },
        reminderSaved: DEFAULT_STATE.reminderSaved,
      }
    }

    const parsed: unknown = JSON.parse(raw)
    const root = isRecord(parsed) ? parsed : {}
    const config = sanitizeConfig(root.config)
    const appState = sanitizeAppState(root.appState, config.targets)

    return {
      config,
      appState,
      reminderSaved: toBool(root.reminderSaved, false),
    }
  } catch {
    return {
      config: { ...DEFAULT_CONFIG, targets: { ...DEFAULT_CONFIG.targets } },
      appState: {
        ...DEFAULT_APP_STATE,
        targets: { ...DEFAULT_APP_STATE.targets },
        current: { ...DEFAULT_APP_STATE.current },
      },
      reminderSaved: DEFAULT_STATE.reminderSaved,
    }
  }
}

export function saveQuestboardState(state: QuestboardState): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function isWalkthroughComplete(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(WALKTHROUGH_DONE_KEY) === '1'
}

export function setWalkthroughComplete(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(WALKTHROUGH_DONE_KEY, '1')
}

export function monthInfo(now = new Date()): MonthInfo {
  const year = now.getFullYear()
  const month = now.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const dayIndex = now.getDate()
  const daysElapsed = dayIndex - 1
  const daysLeft = Math.max(0, daysInMonth - dayIndex)
  const expectedPct = daysElapsed <= 0 ? 0 : (daysElapsed / daysInMonth) * 100
  return { daysInMonth, dayIndex, daysLeft, expectedPct }
}

export function computeScore(appState: AppProgressState): number {
  return Math.round(appState.current.debt + appState.current.tracks * 100)
}

export function computeLevel(score: number): number {
  return Math.max(1, 1 + Math.floor(score / 400))
}

export function computeRank(score: number): RankInfo {
  if (score >= 1200) {
    return { name: 'PLATINUM', next: null, nextAt: null }
  }
  if (score >= 800) {
    return { name: 'GOLD', next: 'PLATINUM', nextAt: 1200 }
  }
  if (score >= 400) {
    return { name: 'SILVER', next: 'GOLD', nextAt: 800 }
  }
  return { name: 'BRONZE', next: 'SILVER', nextAt: 400 }
}

export function computeProgressPct(value: number, target: number): number {
  if (target <= 0) {
    return 0
  }
  return Math.min((value / target) * 100, 100)
}

export function paceTag(objectivePct: number, expectedPct: number): PaceInfo {
  const delta = objectivePct - expectedPct
  if (delta >= 8) {
    return { label: 'AHEAD', className: 'good' }
  }
  if (delta <= -8) {
    return { label: 'BEHIND', className: 'bad' }
  }
  return { label: 'ON PACE', className: 'warn' }
}

export function formatClock(now = new Date()): string {
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function formatMoney(value: number): string {
  return `$${clampNonNegative(value)}`
}

function uid(): string {
  return `${Math.random().toString(16).slice(2)}@questboard`
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateStamp(date: Date): string {
  return (
    date.getFullYear() +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    'T' +
    pad2(date.getHours()) +
    pad2(date.getMinutes()) +
    '00'
  )
}

export function buildReminderIcs(config: QuestConfig, appLink: string): string {
  const now = new Date()
  const targetDow = WEEKDAYS.indexOf(config.day)

  const next = new Date(now)
  while (next.getDay() !== targetDow) {
    next.setDate(next.getDate() + 1)
  }

  const [hours, minutes] = (config.time || '19:00').split(':').map(Number)
  next.setHours(Number.isFinite(hours) ? hours : 19, Number.isFinite(minutes) ? minutes : 0, 0, 0)

  const monthReset = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0, 0)

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Questboard//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${uid()}
DTSTAMP:${formatDateStamp(now)}
DTSTART:${formatDateStamp(next)}
SUMMARY:Questboard — Weekly Check-in
DESCRIPTION:Log your three numbers. ${appLink}
RRULE:FREQ=WEEKLY
END:VEVENT
BEGIN:VEVENT
UID:${uid()}
DTSTAMP:${formatDateStamp(now)}
DTSTART:${formatDateStamp(monthReset)}
SUMMARY:Questboard — Monthly Reset
DESCRIPTION:New month. Review targets + pacing. ${appLink}
RRULE:FREQ=MONTHLY
END:VEVENT
END:VCALENDAR`
}

export function downloadReminderIcs(config: QuestConfig, appLink: string): void {
  const ics = buildReminderIcs(config, appLink)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'questboard.ics'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export function getStreakTag(streakWeeks: number): string {
  if (streakWeeks >= 8) {
    return 'HARDENED'
  }
  if (streakWeeks >= 4) {
    return 'SOLID'
  }
  return 'BUILDING'
}

export function getTactics(
  debtPct: number,
  tracksPct: number,
  expectedPct: number,
): { text: string; action: string; tag: string } {
  if (tracksPct < expectedPct - 8) {
    return {
      text: 'Tracks are behind the month clock. Fix the bottleneck with a single protected block.',
      action: 'Schedule 1× 60–90 min track session in the next 72 hours. Treat it like a meeting.',
      tag: 'TRACKS',
    }
  }
  if (debtPct < expectedPct - 8) {
    return {
      text: 'Debt is behind pace. Reduce decision-fatigue with one automatic move.',
      action: 'Set or increase one automatic weekly payment, even if small.',
      tag: 'DEBT',
    }
  }
  return {
    text: "You're on pace. Don't over-touch the system. Protect consistency.",
    action: 'Do nothing extra. Wait for the next calendar event, then log once.',
    tag: 'MAINTAIN',
  }
}
