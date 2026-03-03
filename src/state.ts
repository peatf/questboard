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

export interface BudgetPlan {
  monthlyIncome: number
  monthlyFixedBills: number
  eoySavingsGoal: number
  goalYear: number
  goalStartAt: number
}

export interface QuestConfig {
  name: string
  day: Weekday
  time: string
  targets: Targets
  trusted: string
  midweek: boolean
  prep: boolean
  budgetPlan: BudgetPlan
}

export interface SpendingTotals {
  required: number
  discretionary: number
}

export interface FinanceLogEntry {
  id: string
  weekKey: string
  loggedAt: number
  debtPaid: number
  tracksMade: number
  savingsAdded: number
  requiredSpend: number
  discretionarySpend: number
  note: string
  financeXp: number
}

export interface AppProgressState {
  targets: Targets
  current: {
    debt: number
    savings: number
    tracks: number
  }
  spending: SpendingTotals
  streakWeeks: number
  financeXp: number
  logs: FinanceLogEntry[]
}

export interface SyncConfig {
  enabled: boolean
  vaultId: string
  syncKey: string
  deviceId: string
  lastSyncedAt: number | null
  lastPulledRevision: number | null
}

export interface QuestboardState {
  schemaVersion: 3
  config: QuestConfig
  appState: AppProgressState
  reminderSaved: boolean
  sync: SyncConfig
}

export interface WeeklyLogEntry {
  debt: number
  savings: number
  tracks: number
  requiredSpend: number
  discretionarySpend: number
  note?: string
  logId?: string
}

export type WalkthroughTarget = 'log' | 'monthly' | 'calendar'
export type WalkthroughVersion = 'finance-v1'

export interface WalkthroughVersionProgress {
  dismissCount: number
  completedAt: number | null
  lastShownAt: number | null
}

export type WalkthroughProgress = Record<WalkthroughVersion, WalkthroughVersionProgress>
export type SaveStateSource = 'local-change' | 'sync-pull' | 'sync-system'

export interface SaveStateOptions {
  source?: SaveStateSource
}

export interface QuestboardStateSavedEventDetail {
  state: QuestboardState
  source: SaveStateSource
  at: number
}

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

export interface SavingsTargets {
  goalYear: number
  remainingGoal: number
  weeklySavingsTarget: number
  monthlySavingsTarget: number
  weeksRemaining: number
  monthsRemainingIncludingCurrent: number
  projectedYearEndSavings: number
  projectedGap: number
}

export interface BudgetAvailability {
  monthlyDiscretionaryBudget: number
  weeklyDiscretionaryBudget: number
  discretionarySpentThisMonth: number
  discretionaryRemainingThisMonth: number
  expectedDiscretionaryToDate: number
}

export interface PurchaseDecisionInput {
  cost: number
  timing: 'now' | 'this-week' | 'this-month'
  itemName?: string
}

export interface PurchaseDecisionContext {
  discretionaryBudgetRemaining: number
  weeklySavingsTarget: number
  projectedYearEndSavings: number
  eoySavingsGoal: number
}

export interface PurchaseDecisionResult {
  verdict: 'YES' | 'CAUTION' | 'NO'
  reason: string
  impact: {
    discretionaryRemainingAfter: number
    projectedYearEndAfter: number
    shortfallAfter: number
  }
}

export interface RecalculatedProgress {
  current: {
    debt: number
    savings: number
    tracks: number
  }
  spending: SpendingTotals
  streakWeeks: number
  financeXp: number
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

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = 7 * MS_PER_DAY

export const STORAGE_KEY = 'questboard_v2'
export const LEGACY_STORAGE_KEY = 'questboard_v1'
export const WALKTHROUGH_DONE_KEY = 'questboard_wt_done'
export const WALKTHROUGH_PROGRESS_KEY = 'questboard_walkthrough_progress'
export const QUESTBOARD_STATE_SAVED_EVENT = 'questboard:state-saved'

const WALKTHROUGH_VERSIONS: WalkthroughVersion[] = ['finance-v1']

function currentYear(now = new Date()): number {
  return now.getFullYear()
}

function defaultBudgetPlan(now = new Date()): BudgetPlan {
  return {
    monthlyIncome: 0,
    monthlyFixedBills: 0,
    eoySavingsGoal: 0,
    goalYear: currentYear(now),
    goalStartAt: now.getTime(),
  }
}

const DEFAULT_CONFIG: QuestConfig = {
  name: 'Elias',
  day: 'Sunday',
  time: '19:00',
  targets: { debt: 800, tracks: 8 },
  trusted: '',
  midweek: true,
  prep: false,
  budgetPlan: defaultBudgetPlan(),
}

const DEFAULT_APP_STATE: AppProgressState = {
  targets: { debt: 800, tracks: 8 },
  current: { debt: 0, savings: 0, tracks: 0 },
  spending: { required: 0, discretionary: 0 },
  streakWeeks: 0,
  financeXp: 0,
  logs: [],
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  vaultId: '',
  syncKey: '',
  deviceId: '',
  lastSyncedAt: null,
  lastPulledRevision: null,
}

const DEFAULT_STATE: QuestboardState = {
  schemaVersion: 3,
  config: DEFAULT_CONFIG,
  appState: DEFAULT_APP_STATE,
  reminderSaved: false,
  sync: DEFAULT_SYNC_CONFIG,
}

function createDefaultState(): QuestboardState {
  return {
    schemaVersion: 3,
    config: {
      ...DEFAULT_CONFIG,
      targets: { ...DEFAULT_CONFIG.targets },
      budgetPlan: { ...DEFAULT_CONFIG.budgetPlan },
    },
    appState: {
      ...DEFAULT_APP_STATE,
      targets: { ...DEFAULT_APP_STATE.targets },
      current: { ...DEFAULT_APP_STATE.current },
      spending: { ...DEFAULT_APP_STATE.spending },
      logs: [],
    },
    reminderSaved: DEFAULT_STATE.reminderSaved,
    sync: { ...DEFAULT_SYNC_CONFIG },
  }
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

function sanitizeBudgetPlan(value: unknown): BudgetPlan {
  const fallback = defaultBudgetPlan()
  if (!isRecord(value)) {
    return fallback
  }

  const now = new Date()
  const nowYear = now.getFullYear()

  const parsedGoalYear = clampNonNegative(Number(value.goalYear ?? fallback.goalYear))
  const normalizedGoalYear = parsedGoalYear >= nowYear ? parsedGoalYear : nowYear

  const parsedGoalStartAt =
    typeof value.goalStartAt === 'number' && Number.isFinite(value.goalStartAt)
      ? value.goalStartAt
      : fallback.goalStartAt

  return {
    monthlyIncome: clampNonNegative(Number(value.monthlyIncome ?? fallback.monthlyIncome)),
    monthlyFixedBills: clampNonNegative(Number(value.monthlyFixedBills ?? fallback.monthlyFixedBills)),
    eoySavingsGoal: clampNonNegative(Number(value.eoySavingsGoal ?? fallback.eoySavingsGoal)),
    goalYear: normalizedGoalYear,
    goalStartAt: Math.min(parsedGoalStartAt, now.getTime()),
  }
}

function sanitizeConfig(value: unknown): QuestConfig {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_CONFIG,
      targets: { ...DEFAULT_CONFIG.targets },
      budgetPlan: { ...DEFAULT_CONFIG.budgetPlan },
    }
  }

  return {
    name: toText(value.name, DEFAULT_CONFIG.name) || DEFAULT_CONFIG.name,
    day: toWeekday(value.day),
    time: toText(value.time, DEFAULT_CONFIG.time) || DEFAULT_CONFIG.time,
    targets: sanitizeTargets(value.targets, DEFAULT_CONFIG.targets),
    trusted: toText(value.trusted, ''),
    midweek: toBool(value.midweek, DEFAULT_CONFIG.midweek),
    prep: toBool(value.prep, DEFAULT_CONFIG.prep),
    budgetPlan: sanitizeBudgetPlan(value.budgetPlan),
  }
}

function normalizeWeekKey(value: unknown, fallbackDate: number): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  return getWeekKey(new Date(fallbackDate))
}

function sanitizeLogEntry(value: unknown, index: number): FinanceLogEntry | null {
  if (!isRecord(value)) {
    return null
  }

  const loggedAt =
    typeof value.loggedAt === 'number' && Number.isFinite(value.loggedAt) ? value.loggedAt : Date.now()

  const id =
    typeof value.id === 'string' && value.id.trim()
      ? value.id.trim()
      : `log-${loggedAt}-${index}`

  return {
    id,
    weekKey: normalizeWeekKey(value.weekKey, loggedAt),
    loggedAt,
    debtPaid: clampNonNegative(Number(value.debtPaid ?? 0)),
    tracksMade: clampNonNegative(Number(value.tracksMade ?? 0)),
    savingsAdded: clampNonNegative(Number(value.savingsAdded ?? 0)),
    requiredSpend: clampNonNegative(Number(value.requiredSpend ?? 0)),
    discretionarySpend: clampNonNegative(Number(value.discretionarySpend ?? 0)),
    note: toText(value.note, ''),
    financeXp: clampNonNegative(Number(value.financeXp ?? 0)),
  }
}

function sanitizeLogs(value: unknown): FinanceLogEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry, index) => sanitizeLogEntry(entry, index))
    .filter((entry): entry is FinanceLogEntry => entry !== null)
    .sort((a, b) => a.loggedAt - b.loggedAt)
}

function sanitizeAppState(value: unknown, fallbackTargets: Targets): AppProgressState {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_APP_STATE,
      targets: { ...fallbackTargets },
      spending: { ...DEFAULT_APP_STATE.spending },
      logs: [],
    }
  }

  const targets = sanitizeTargets(value.targets, fallbackTargets)
  const current = isRecord(value.current) ? value.current : {}
  const logs = sanitizeLogs(value.logs)

  const logsTotals = recalculateProgressFromLogs(logs)

  const currentDebt = clampNonNegative(Number(current.debt ?? logsTotals.current.debt))
  const currentSavings = clampNonNegative(Number(current.savings ?? logsTotals.current.savings))
  const currentTracks = clampNonNegative(Number(current.tracks ?? logsTotals.current.tracks))

  return {
    targets,
    current: {
      debt: Math.max(currentDebt, logsTotals.current.debt),
      savings: Math.max(currentSavings, logsTotals.current.savings),
      tracks: Math.max(currentTracks, logsTotals.current.tracks),
    },
    spending: {
      required: Math.max(
        clampNonNegative(Number(isRecord(value.spending) ? value.spending.required : 0)),
        logsTotals.spending.required,
      ),
      discretionary: Math.max(
        clampNonNegative(Number(isRecord(value.spending) ? value.spending.discretionary : 0)),
        logsTotals.spending.discretionary,
      ),
    },
    streakWeeks: clampNonNegative(Number(value.streakWeeks ?? logsTotals.streakWeeks)),
    financeXp: Math.max(clampNonNegative(Number(value.financeXp ?? logsTotals.financeXp)), logsTotals.financeXp),
    logs,
  }
}

function sanitizeSyncConfig(value: unknown): SyncConfig {
  if (!isRecord(value)) {
    return { ...DEFAULT_SYNC_CONFIG }
  }

  return {
    enabled: toBool(value.enabled, DEFAULT_SYNC_CONFIG.enabled),
    vaultId: toText(value.vaultId, ''),
    syncKey: toText(value.syncKey, ''),
    deviceId: toText(value.deviceId, ''),
    lastSyncedAt:
      typeof value.lastSyncedAt === 'number' && Number.isFinite(value.lastSyncedAt)
        ? value.lastSyncedAt
        : null,
    lastPulledRevision:
      typeof value.lastPulledRevision === 'number' && Number.isFinite(value.lastPulledRevision)
        ? clampNonNegative(value.lastPulledRevision)
        : null,
  }
}

export function hydrateQuestboardState(value: unknown): QuestboardState {
  const root = isRecord(value) ? value : {}
  const config = sanitizeConfig(root.config)
  const appState = sanitizeAppState(root.appState, config.targets)
  const sync = sanitizeSyncConfig(root.sync)

  return {
    schemaVersion: 3,
    config,
    appState,
    reminderSaved: toBool(root.reminderSaved, false),
    sync,
  }
}

export function isLegacyDemoSeedState(state: QuestboardState): boolean {
  const { config, appState } = state
  return (
    config.name === 'Elias' &&
    config.day === 'Sunday' &&
    config.time === '19:00' &&
    config.targets.debt === 800 &&
    config.targets.tracks === 8 &&
    config.trusted === '' &&
    config.midweek === true &&
    config.prep === false &&
    appState.current.debt === 200 &&
    appState.current.savings === 150 &&
    appState.current.tracks === 2 &&
    appState.streakWeeks === 4
  )
}

export function clearProgressState(state: QuestboardState): QuestboardState {
  return {
    ...state,
    appState: {
      ...state.appState,
      current: {
        debt: 0,
        savings: 0,
        tracks: 0,
      },
      spending: {
        required: 0,
        discretionary: 0,
      },
      streakWeeks: 0,
      financeXp: 0,
      logs: [],
    },
  }
}

export function loadQuestboardState(): QuestboardState {
  if (typeof window === 'undefined') {
    return createDefaultState()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      return hydrateQuestboardState(parsed)
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      const parsedLegacy: unknown = JSON.parse(legacyRaw)
      const migrated = hydrateQuestboardState(parsedLegacy)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    }

    return createDefaultState()
  } catch {
    return createDefaultState()
  }
}

export function saveQuestboardState(state: QuestboardState, options: SaveStateOptions = {}): void {
  if (typeof window === 'undefined') {
    return
  }

  const nextState = hydrateQuestboardState(state)
  const source: SaveStateSource = options.source ?? 'local-change'
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  window.dispatchEvent(
    new CustomEvent<QuestboardStateSavedEventDetail>(QUESTBOARD_STATE_SAVED_EVENT, {
      detail: {
        state: nextState,
        source,
        at: Date.now(),
      },
    }),
  )
}

function createDefaultWalkthroughProgress(): WalkthroughProgress {
  return {
    'finance-v1': {
      dismissCount: 0,
      completedAt: null,
      lastShownAt: null,
    },
  }
}

function toWalkthroughTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return Math.round(value)
}

function sanitizeWalkthroughVersionProgress(value: unknown): WalkthroughVersionProgress {
  const fallback = createDefaultWalkthroughProgress()['finance-v1']
  if (!isRecord(value)) {
    return { ...fallback }
  }

  const dismissCount = Math.min(2, clampNonNegative(Number(value.dismissCount ?? fallback.dismissCount)))

  return {
    dismissCount,
    completedAt: toWalkthroughTimestamp(value.completedAt),
    lastShownAt: toWalkthroughTimestamp(value.lastShownAt),
  }
}

function persistWalkthroughProgress(progress: WalkthroughProgress): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(WALKTHROUGH_PROGRESS_KEY, JSON.stringify(progress))
}

function updateWalkthroughVersionProgress(
  version: WalkthroughVersion,
  updater: (progress: WalkthroughVersionProgress) => WalkthroughVersionProgress,
): void {
  const current = loadWalkthroughProgress()
  current[version] = updater(current[version])
  persistWalkthroughProgress(current)
}

export function loadWalkthroughProgress(): WalkthroughProgress {
  const fallback = createDefaultWalkthroughProgress()
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(WALKTHROUGH_PROGRESS_KEY)
    if (!raw) {
      return fallback
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return fallback
    }

    const progress = createDefaultWalkthroughProgress()
    for (const version of WALKTHROUGH_VERSIONS) {
      progress[version] = sanitizeWalkthroughVersionProgress(parsed[version])
    }
    return progress
  } catch {
    return fallback
  }
}

export function shouldShowWalkthrough(version: WalkthroughVersion): boolean {
  const progress = loadWalkthroughProgress()[version]
  return progress.completedAt === null && progress.dismissCount < 2
}

export function markWalkthroughShown(version: WalkthroughVersion): void {
  updateWalkthroughVersionProgress(version, (progress) => ({
    ...progress,
    lastShownAt: Date.now(),
  }))
}

export function markWalkthroughSkipped(version: WalkthroughVersion): void {
  updateWalkthroughVersionProgress(version, (progress) => ({
    ...progress,
    dismissCount: Math.min(2, progress.dismissCount + 1),
  }))
}

export function markWalkthroughCompleted(version: WalkthroughVersion): void {
  updateWalkthroughVersionProgress(version, (progress) => ({
    ...progress,
    completedAt: Date.now(),
  }))
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
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
  const dayIndex = now.getDate()
  const daysElapsed = dayIndex - 1
  const daysLeft = Math.max(0, daysInMonth - dayIndex)
  const expectedPct = daysElapsed <= 0 ? 0 : (daysElapsed / daysInMonth) * 100
  return { daysInMonth, dayIndex, daysLeft, expectedPct }
}

function monthsRemainingIncludingCurrent(goalYear: number, now: Date): number {
  const yearDiff = goalYear - now.getFullYear()
  const months = yearDiff * 12 + (11 - now.getMonth()) + 1
  return Math.max(1, months)
}

export function computeSavingsTargets(
  plan: BudgetPlan,
  currentSavings: number,
  now = new Date(),
): SavingsTargets {
  const safeCurrentSavings = clampNonNegative(currentSavings)
  const effectiveGoalYear = Math.max(plan.goalYear, now.getFullYear())
  const goalDeadline = new Date(effectiveGoalYear, 11, 31, 23, 59, 59, 999)
  const weeksRemaining = Math.max(1, Math.ceil((goalDeadline.getTime() - now.getTime()) / MS_PER_WEEK))

  const remainingGoal = Math.max(0, clampNonNegative(plan.eoySavingsGoal) - safeCurrentSavings)
  const monthsRemaining = monthsRemainingIncludingCurrent(effectiveGoalYear, now)

  const weeklySavingsTarget = remainingGoal / weeksRemaining
  const monthlySavingsTarget = remainingGoal / monthsRemaining

  const startMs =
    Number.isFinite(plan.goalStartAt) && plan.goalStartAt > 0 ? plan.goalStartAt : new Date(now.getFullYear(), 0, 1).getTime()
  const elapsedWeeks = Math.max(1, Math.ceil((now.getTime() - startMs) / MS_PER_WEEK))
  const weeklyAverageSaved = safeCurrentSavings / elapsedWeeks
  const projectedYearEndSavings = Math.max(0, safeCurrentSavings + weeklyAverageSaved * weeksRemaining)
  const projectedGap = Math.max(0, clampNonNegative(plan.eoySavingsGoal) - projectedYearEndSavings)

  return {
    goalYear: effectiveGoalYear,
    remainingGoal,
    weeklySavingsTarget,
    monthlySavingsTarget,
    weeksRemaining,
    monthsRemainingIncludingCurrent: monthsRemaining,
    projectedYearEndSavings,
    projectedGap,
  }
}

export function computeBudgetAvailability(
  plan: BudgetPlan,
  spendingTotals: SpendingTotals,
  now = new Date(),
  currentSavings = 0,
): BudgetAvailability {
  const savingsTargets = computeSavingsTargets(plan, currentSavings, now)
  const monthlyDiscretionaryBudget = Math.max(
    0,
    clampNonNegative(plan.monthlyIncome) - clampNonNegative(plan.monthlyFixedBills) - savingsTargets.monthlySavingsTarget,
  )
  const weeklyDiscretionaryBudget = (monthlyDiscretionaryBudget * 12) / 52

  const month = monthInfo(now)
  const expectedDiscretionaryToDate = (monthlyDiscretionaryBudget * month.expectedPct) / 100
  const discretionarySpentThisMonth = clampNonNegative(spendingTotals.discretionary)
  const discretionaryRemainingThisMonth = Math.max(0, monthlyDiscretionaryBudget - discretionarySpentThisMonth)

  return {
    monthlyDiscretionaryBudget,
    weeklyDiscretionaryBudget,
    discretionarySpentThisMonth,
    discretionaryRemainingThisMonth,
    expectedDiscretionaryToDate,
  }
}

export function computeMonthSpendingFromLogs(logs: FinanceLogEntry[], now = new Date()): SpendingTotals {
  const year = now.getFullYear()
  const month = now.getMonth()

  return logs.reduce(
    (totals, entry) => {
      const loggedAt = new Date(entry.loggedAt)
      if (loggedAt.getFullYear() !== year || loggedAt.getMonth() !== month) {
        return totals
      }

      totals.required += clampNonNegative(entry.requiredSpend)
      totals.discretionary += clampNonNegative(entry.discretionarySpend)
      return totals
    },
    { required: 0, discretionary: 0 },
  )
}

export function evaluatePurchaseDecision(
  input: PurchaseDecisionInput,
  context: PurchaseDecisionContext,
): PurchaseDecisionResult {
  const cost = clampNonNegative(input.cost)
  const discretionaryRemainingAfter = context.discretionaryBudgetRemaining - cost
  const projectedYearEndAfter = Math.max(0, context.projectedYearEndSavings - cost)
  const shortfallAfter = Math.max(0, context.eoySavingsGoal - projectedYearEndAfter)

  if (shortfallAfter >= context.weeklySavingsTarget && context.weeklySavingsTarget > 0) {
    return {
      verdict: 'NO',
      reason: 'This purchase puts you at least one full weekly savings target behind pace.',
      impact: {
        discretionaryRemainingAfter,
        projectedYearEndAfter,
        shortfallAfter,
      },
    }
  }

  if (shortfallAfter > 0 || discretionaryRemainingAfter < 0) {
    return {
      verdict: 'CAUTION',
      reason: 'This purchase is close, but it creates a shortfall that requires a catch-up move soon.',
      impact: {
        discretionaryRemainingAfter,
        projectedYearEndAfter,
        shortfallAfter,
      },
    }
  }

  return {
    verdict: 'YES',
    reason: 'You can buy this and still protect bills, discretionary budget, and savings pace.',
    impact: {
      discretionaryRemainingAfter,
      projectedYearEndAfter,
      shortfallAfter,
    },
  }
}

function parseTimeToHoursMinutes(time: string): { hours: number; minutes: number } {
  const [rawHours, rawMinutes] = time.split(':').map(Number)
  const hours = Number.isFinite(rawHours) ? rawHours : 19
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0
  return {
    hours: Math.min(23, Math.max(0, hours)),
    minutes: Math.min(59, Math.max(0, minutes)),
  }
}

export function getWeekKey(date = new Date()): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function parseWeekKey(weekKey: string): { year: number; week: number } | null {
  const parsed = /^(\d{4})-W(\d{2})$/.exec(weekKey.trim())
  if (!parsed) {
    return null
  }
  const year = Number(parsed[1])
  const week = Number(parsed[2])
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    return null
  }
  return { year, week }
}

function isoMondayForWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const jan4IsoDay = jan4.getDay() === 0 ? 7 : jan4.getDay()
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - jan4IsoDay + 1 + (week - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function weekdayToIso(day: Weekday): number {
  const index = WEEKDAYS.indexOf(day)
  return index === 0 ? 7 : index
}

function dueDateForWeekKey(weekKey: string, config: QuestConfig): Date | null {
  const parsed = parseWeekKey(weekKey)
  if (!parsed) {
    return null
  }
  const { hours, minutes } = parseTimeToHoursMinutes(config.time)
  const monday = isoMondayForWeek(parsed.year, parsed.week)
  const due = new Date(monday)
  due.setDate(monday.getDate() + (weekdayToIso(config.day) - 1))
  due.setHours(hours, minutes, 0, 0)
  return due
}

export function isLogOnTime(config: QuestConfig, weekKey: string, loggedAt: number): boolean {
  if (!Number.isFinite(loggedAt)) {
    return false
  }
  const due = dueDateForWeekKey(weekKey, config)
  if (!due) {
    return false
  }
  return loggedAt <= due.getTime()
}

export function isWeeklyLogOverdue(config: QuestConfig, logs: FinanceLogEntry[], now = new Date()): boolean {
  const dayIndex = WEEKDAYS.indexOf(config.day)
  const { hours, minutes } = parseTimeToHoursMinutes(config.time)

  const latestDue = new Date(now)
  latestDue.setHours(hours, minutes, 0, 0)

  const diff = (now.getDay() - dayIndex + 7) % 7
  latestDue.setDate(now.getDate() - diff)

  if (now.getTime() < latestDue.getTime()) {
    return false
  }

  const dueWeekKey = getWeekKey(latestDue)
  return !logs.some((entry) => entry.weekKey === dueWeekKey)
}

export interface FinanceXpContext {
  weeklySavingsTarget: number
  weeklyDiscretionaryBudget: number
  isOnTime: boolean
}

export function computeFinanceXp(logEntry: FinanceLogEntry, context: FinanceXpContext): number {
  let xp = 0
  if (context.isOnTime) {
    xp += 20
  }
  if (logEntry.savingsAdded >= context.weeklySavingsTarget && context.weeklySavingsTarget > 0) {
    xp += 30
  }
  if (logEntry.discretionarySpend <= context.weeklyDiscretionaryBudget) {
    xp += 30
  }
  return xp
}

export function recalculateProgressFromLogs(logs: FinanceLogEntry[]): RecalculatedProgress {
  const totals = logs.reduce(
    (acc, entry) => {
      acc.current.debt += clampNonNegative(entry.debtPaid)
      acc.current.savings += clampNonNegative(entry.savingsAdded)
      acc.current.tracks += clampNonNegative(entry.tracksMade)
      acc.spending.required += clampNonNegative(entry.requiredSpend)
      acc.spending.discretionary += clampNonNegative(entry.discretionarySpend)
      acc.financeXp += clampNonNegative(entry.financeXp)
      return acc
    },
    {
      current: { debt: 0, savings: 0, tracks: 0 },
      spending: { required: 0, discretionary: 0 },
      financeXp: 0,
    },
  )

  const uniqueWeeks = new Set(logs.map((entry) => entry.weekKey)).size

  return {
    current: {
      debt: clampNonNegative(totals.current.debt),
      savings: clampNonNegative(totals.current.savings),
      tracks: clampNonNegative(totals.current.tracks),
    },
    spending: {
      required: clampNonNegative(totals.spending.required),
      discretionary: clampNonNegative(totals.spending.discretionary),
    },
    streakWeeks: clampNonNegative(uniqueWeeks),
    financeXp: clampNonNegative(totals.financeXp),
  }
}

export function computeScore(appState: AppProgressState): number {
  const legacyScore = Math.round(appState.current.debt + appState.current.tracks * 100)
  return legacyScore + clampNonNegative(appState.financeXp)
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
  if (next <= now) {
    next.setDate(next.getDate() + 7)
  }

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
DESCRIPTION:Log debt, savings, required spend, discretionary spend, and tracks. ${appLink}
RRULE:FREQ=WEEKLY
END:VEVENT
BEGIN:VEVENT
UID:${uid()}
DTSTAMP:${formatDateStamp(now)}
DTSTART:${formatDateStamp(monthReset)}
SUMMARY:Questboard — Monthly Reset
DESCRIPTION:Review budget mission, year-end savings pace, and monthly targets. ${appLink}
RRULE:FREQ=MONTHLY
END:VEVENT
END:VCALENDAR`
}

type ReminderExportResult = 'shared' | 'downloaded' | 'cancelled'

function triggerReminderDownload(ics: string): void {
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

function isIPhoneChrome(): boolean {
  const ua = navigator.userAgent || ''
  return /CriOS/i.test(ua) && /iPhone|iPod|iPad/i.test(ua)
}

async function tryShareReminderFile(ics: string): Promise<ReminderExportResult> {
  if (!navigator.share) {
    return 'downloaded'
  }

  const file = new File([ics], 'questboard.ics', { type: 'text/calendar' })

  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    return 'downloaded'
  }

  try {
    await navigator.share({
      title: 'Questboard reminder',
      text: 'Add this reminder to your Calendar.',
      files: [file],
    })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled'
    }
    return 'downloaded'
  }
}

export async function downloadReminderIcs(config: QuestConfig, appLink: string): Promise<ReminderExportResult> {
  const ics = buildReminderIcs(config, appLink)

  if (isIPhoneChrome()) {
    const shareResult = await tryShareReminderFile(ics)
    if (shareResult === 'shared' || shareResult === 'cancelled') {
      return shareResult
    }
  }

  triggerReminderDownload(ics)
  return 'downloaded'
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
      text: "Tracks are behind this month's pace. Fix the bottleneck with one protected block.",
      action: 'Schedule one 60-90 min track session in the next 72 hours. Treat it like a meeting.',
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
    text: "You're on pace. Don't overwork the system. Protect consistency.",
    action: 'Do nothing extra. Wait for the next reminder, then log once.',
    tag: 'MAINTAIN',
  }
}
