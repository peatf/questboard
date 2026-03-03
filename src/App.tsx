import { useCallback, useEffect, useRef, useState } from 'react'
import { DashboardScreen } from './components/DashboardScreen'
import { RecapOverlay, type RecapData } from './components/RecapOverlay'
import { ReminderScreen } from './components/ReminderScreen'
import { SetupScreen } from './components/SetupScreen'
import { SyncConflictOverlay, SyncPanel } from './components/SyncPanel'
import { WalkthroughOverlay } from './components/WalkthroughOverlay'
import { WindowShell } from './components/WindowShell'
import { FINANCE_WALKTHROUGH_STEPS, FINANCE_WALKTHROUGH_VERSION } from './content/financeWalkthrough'
import {
  QUESTBOARD_STATE_SAVED_EVENT,
  DEFAULT_SYNC_CONFIG,
  clearProgressState,
  clampNonNegative,
  computeBudgetAvailability,
  computeFinanceXp,
  computeMonthSpendingFromLogs,
  computeProgressPct,
  computeSavingsTargets,
  computeScore,
  downloadReminderIcs,
  formatClock,
  getWeekKey,
  isLegacyDemoSeedState,
  isLogOnTime,
  isWeeklyLogOverdue,
  loadQuestboardState,
  markWalkthroughCompleted,
  markWalkthroughShown,
  markWalkthroughSkipped,
  recalculateProgressFromLogs,
  saveQuestboardState,
  shouldShowWalkthrough,
  type FinanceLogEntry,
  type QuestboardState,
  type QuestboardStateSavedEventDetail,
  type SaveStateSource,
  type WalkthroughTarget,
  type WeeklyLogEntry,
} from './state'
import {
  SyncConflictError,
  clearSyncHash,
  createDeviceId,
  createVault,
  getSyncLink,
  parseSyncHash,
  pullState,
  pushState,
  type PullResult,
  type SyncCredentials,
} from './sync'

type Screen = 'setup' | 'reminder' | 'dashboard'
type SyncStatus = 'not-enabled' | 'syncing' | 'synced' | 'offline' | 'error'
type WalkthroughOpenSource = 'auto' | 'manual'

interface PendingConflict {
  cloud: PullResult
  credentials: SyncCredentials
}

const REMINDER_APP_LINK = 'https://tinyurl.com/ellquest'
const SYNC_ENABLED_FLAG = import.meta.env.VITE_SYNC_ENABLED === 'true'
const HAS_SYNC_API = Boolean(import.meta.env.VITE_SYNC_API_BASE?.trim())
const TELEMETRY_EVENT = 'questboard:telemetry'

function emitTelemetry(event: string, detail: Record<string, unknown> = {}): void {
  window.dispatchEvent(
    new CustomEvent(TELEMETRY_EVENT, {
      detail: {
        event,
        at: Date.now(),
        ...detail,
      },
    }),
  )
}

function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case 'syncing':
      return 'SYNCING'
    case 'synced':
      return 'SYNCED'
    case 'offline':
      return 'OFFLINE'
    case 'error':
      return 'SYNC ERROR'
    default:
      return 'NOT ENABLED'
  }
}

function createLogId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `log-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function App() {
  const [questState, setQuestState] = useState<QuestboardState>(() => loadQuestboardState())
  const [screen, setScreen] = useState<Screen>('setup')
  const [clock, setClock] = useState<string>(() => formatClock(new Date()))

  const [walkthroughOpen, setWalkthroughOpen] = useState(false)
  const [walkthroughStep, setWalkthroughStep] = useState(1)
  const [walkthroughOpenSource, setWalkthroughOpenSource] = useState<WalkthroughOpenSource | null>(null)

  const [pendingState, setPendingState] = useState<QuestboardState | null>(null)
  const [recap, setRecap] = useState<RecapData | null>(null)

  const [syncPanelOpen, setSyncPanelOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('not-enabled')
  const [syncMessage, setSyncMessage] = useState('')
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null)

  const questStateRef = useRef(questState)
  const syncPushTimerRef = useRef<number | null>(null)
  const dirtySincePullRef = useRef(false)
  const syncInFlightRef = useRef(false)
  const walkthroughAutoShownThisSessionRef = useRef(false)

  const syncAvailable = SYNC_ENABLED_FLAG && HAS_SYNC_API

  useEffect(() => {
    questStateRef.current = questState
  }, [questState])

  const persistState = useCallback((nextState: QuestboardState, source: SaveStateSource = 'local-change') => {
    questStateRef.current = nextState
    setQuestState(nextState)
    saveQuestboardState(nextState, { source })
  }, [])

  useEffect(() => {
    if (!isLegacyDemoSeedState(questStateRef.current)) {
      return
    }

    const cleaned = clearProgressState(questStateRef.current)
    persistState(cleaned)
  }, [persistState, questState])

  const applyPulledState = useCallback(
    (
      pulled: PullResult,
      credentials: SyncCredentials,
      source: SaveStateSource,
      statusMessage: string,
    ) => {
      const current = questStateRef.current
      const deviceId = current.sync.deviceId || createDeviceId()
      const nextState: QuestboardState = {
        ...pulled.state,
        schemaVersion: 3,
        sync: {
          enabled: true,
          vaultId: credentials.vaultId,
          syncKey: credentials.syncKey,
          deviceId,
          lastSyncedAt: pulled.updatedAt,
          lastPulledRevision: pulled.revision,
        },
      }

      persistState(nextState, source)
      dirtySincePullRef.current = false
      setSyncStatus('synced')
      setSyncMessage(statusMessage)
      emitTelemetry('restore_success', { revision: pulled.revision })
    },
    [persistState],
  )

  const performPull = useCallback(
    async ({ manual, credentials }: { manual: boolean; credentials?: SyncCredentials }) => {
      if (!syncAvailable) {
        return
      }

      const current = questStateRef.current
      const activeCredentials: SyncCredentials | null = credentials
        ? credentials
        : current.sync.enabled && current.sync.vaultId && current.sync.syncKey
          ? { vaultId: current.sync.vaultId, syncKey: current.sync.syncKey }
          : null

      if (!activeCredentials) {
        return
      }

      if (!navigator.onLine) {
        setSyncStatus('offline')
        if (manual) {
          setSyncMessage('Offline. Pull will resume when connection returns.')
        }
        return
      }

      setSyncStatus('syncing')
      try {
        const pulled = await pullState(activeCredentials)
        const localRevision = current.sync.lastPulledRevision ?? 0

        if (!credentials && pulled.revision <= localRevision) {
          setSyncStatus('synced')
          if (manual) {
            setSyncMessage('Already on latest cloud revision.')
          }
          return
        }

        if (dirtySincePullRef.current && !credentials) {
          setPendingConflict({ cloud: pulled, credentials: activeCredentials })
          setSyncStatus('error')
          setSyncMessage('Sync conflict detected. Choose local or cloud version.')
          emitTelemetry('conflict_detected', { revision: pulled.revision })
          return
        }

        applyPulledState(
          pulled,
          activeCredentials,
          'sync-pull',
          manual ? 'Pulled latest cloud state.' : 'Synced from cloud.',
        )
      } catch (error) {
        if (!navigator.onLine) {
          setSyncStatus('offline')
          setSyncMessage('Offline. Pull failed and will retry after reconnect.')
          return
        }
        setSyncStatus('error')
        setSyncMessage(error instanceof Error ? error.message : 'Failed to pull cloud state.')
        emitTelemetry('sync_fail', { phase: 'pull' })
      }
    },
    [applyPulledState, syncAvailable],
  )

  const performPush = useCallback(
    async ({
      manual,
      forceRevision,
      overrideState,
    }: {
      manual: boolean
      forceRevision?: number | null
      overrideState?: QuestboardState
    }) => {
      if (!syncAvailable) {
        return
      }

      const current = overrideState ?? questStateRef.current
      if (!current.sync.enabled || !current.sync.vaultId || !current.sync.syncKey) {
        return
      }

      if (!navigator.onLine) {
        setSyncStatus('offline')
        if (manual) {
          setSyncMessage('Offline. Push queued until connection returns.')
        }
        return
      }

      if (syncInFlightRef.current) {
        return
      }

      syncInFlightRef.current = true
      setSyncStatus('syncing')
      try {
        const pushed = await pushState({
          state: current,
          vaultId: current.sync.vaultId,
          syncKey: current.sync.syncKey,
          ifRevision: forceRevision ?? current.sync.lastPulledRevision,
        })

        const nextState: QuestboardState = {
          ...current,
          sync: {
            ...current.sync,
            lastPulledRevision: pushed.revision,
            lastSyncedAt: pushed.serverUpdatedAt,
          },
        }

        persistState(nextState, 'sync-system')
        dirtySincePullRef.current = false
        setSyncStatus('synced')
        setSyncMessage(manual ? 'Pushed latest local state.' : 'Synced changes to cloud.')
        emitTelemetry('sync_success', { phase: 'push', revision: pushed.revision })
      } catch (error) {
        if (error instanceof SyncConflictError) {
          try {
            const cloud = await pullState({
              vaultId: current.sync.vaultId,
              syncKey: current.sync.syncKey,
            })
            if (dirtySincePullRef.current) {
              setPendingConflict({
                cloud,
                credentials: { vaultId: current.sync.vaultId, syncKey: current.sync.syncKey },
              })
              setSyncStatus('error')
              setSyncMessage('Sync conflict detected. Choose local or cloud version.')
              emitTelemetry('conflict_detected', { revision: cloud.revision })
              return
            }

            applyPulledState(
              cloud,
              { vaultId: current.sync.vaultId, syncKey: current.sync.syncKey },
              'sync-pull',
              'Cloud version was newer. Updated from cloud.',
            )
          } catch {
            setSyncStatus('error')
            setSyncMessage('Conflict detected, but cloud refresh failed.')
            emitTelemetry('sync_fail', { phase: 'conflict-refresh' })
          }
          return
        }

        if (!navigator.onLine) {
          setSyncStatus('offline')
          setSyncMessage('Offline. Push will retry after reconnect.')
          return
        }

        setSyncStatus('error')
        setSyncMessage(error instanceof Error ? error.message : 'Sync push failed.')
        emitTelemetry('sync_fail', { phase: 'push' })
      } finally {
        syncInFlightRef.current = false
      }
    },
    [applyPulledState, persistState, syncAvailable],
  )

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()))
    tick()
    const timer = window.setInterval(tick, 10000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!syncAvailable) {
      setSyncStatus('not-enabled')
      return
    }

    const connected = questState.sync.enabled && Boolean(questState.sync.vaultId && questState.sync.syncKey)
    setSyncStatus(connected ? (navigator.onLine ? 'synced' : 'offline') : 'not-enabled')
  }, [questState.sync.enabled, questState.sync.syncKey, questState.sync.vaultId, syncAvailable])

  useEffect(() => {
    if (!syncAvailable) {
      return
    }

    const hashPayload = parseSyncHash(window.location.hash)
    if (hashPayload) {
      void (async () => {
        setSyncStatus('syncing')
        try {
          const pulled = await pullState(hashPayload)
          applyPulledState(pulled, hashPayload, 'sync-pull', 'Connected using sync link.')
          clearSyncHash()
        } catch (error) {
          setSyncStatus('error')
          setSyncMessage(error instanceof Error ? error.message : 'Failed to connect from sync link.')
        }
      })()
      return
    }

    if (questStateRef.current.sync.enabled) {
      void performPull({ manual: false })
    }
  }, [applyPulledState, performPull, syncAvailable])

  useEffect(() => {
    if (!syncAvailable) {
      return
    }

    const onStateSaved = (event: Event) => {
      const detail = (event as CustomEvent<QuestboardStateSavedEventDetail>).detail
      if (!detail || detail.source !== 'local-change') {
        return
      }
      if (!detail.state.sync.enabled) {
        return
      }

      dirtySincePullRef.current = true
      if (syncPushTimerRef.current !== null) {
        window.clearTimeout(syncPushTimerRef.current)
      }

      syncPushTimerRef.current = window.setTimeout(() => {
        void performPush({ manual: false })
      }, 1500)
    }

    window.addEventListener(QUESTBOARD_STATE_SAVED_EVENT, onStateSaved)
    return () => {
      window.removeEventListener(QUESTBOARD_STATE_SAVED_EVENT, onStateSaved)
      if (syncPushTimerRef.current !== null) {
        window.clearTimeout(syncPushTimerRef.current)
      }
    }
  }, [performPush, syncAvailable])

  useEffect(() => {
    if (!syncAvailable || !questState.sync.enabled) {
      return
    }

    const poller = window.setInterval(() => {
      void performPull({ manual: false })
    }, 30000)

    return () => window.clearInterval(poller)
  }, [performPull, questState.sync.enabled, syncAvailable])

  useEffect(() => {
    if (!syncAvailable) {
      return
    }

    const onOnline = () => {
      if (!questStateRef.current.sync.enabled) {
        return
      }
      void performPull({ manual: false })
      if (dirtySincePullRef.current) {
        void performPush({ manual: false })
      }
    }

    const onOffline = () => {
      if (!questStateRef.current.sync.enabled) {
        return
      }
      setSyncStatus('offline')
      setSyncMessage('Offline. Local changes continue and sync resumes later.')
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [performPull, performPush, syncAvailable])

  const walkthroughContent = FINANCE_WALKTHROUGH_STEPS

  const handleSetupContinue = (nextConfig: QuestboardState['config']) => {
    const nextState: QuestboardState = {
      ...questState,
      config: nextConfig,
      appState: {
        ...questState.appState,
        targets: {
          debt: nextConfig.targets.debt,
          tracks: nextConfig.targets.tracks,
        },
      },
    }

    persistState(nextState)
    setScreen('reminder')
  }

  const handleEnableSync = async () => {
    if (!syncAvailable) {
      setSyncMessage('Sync is unavailable. Set VITE_SYNC_ENABLED=true and VITE_SYNC_API_BASE.')
      return
    }

    setSyncStatus('syncing')
    try {
      const current = questStateRef.current
      const deviceId = current.sync.deviceId || createDeviceId()
      const createResult = await createVault({ initialState: current })

      const nextState: QuestboardState = {
        ...current,
        sync: {
          enabled: true,
          vaultId: createResult.vaultId,
          syncKey: createResult.syncKey,
          deviceId,
          lastSyncedAt: createResult.serverUpdatedAt,
          lastPulledRevision: createResult.revision,
        },
      }

      persistState(nextState, 'sync-system')
      dirtySincePullRef.current = false
      setSyncStatus('synced')
      setSyncMessage('Sync enabled. Copy and store your private sync link now.')
      emitTelemetry('sync_success', { phase: 'enable' })
    } catch (error) {
      setSyncStatus('error')
      setSyncMessage(error instanceof Error ? error.message : 'Failed to enable sync.')
      emitTelemetry('sync_fail', { phase: 'enable' })
    }
  }

  const handleCopySyncLink = async () => {
    if (!questState.sync.enabled) {
      return
    }

    const link = getSyncLink(questState.sync.vaultId, questState.sync.syncKey)
    try {
      await navigator.clipboard.writeText(link)
      setSyncMessage('Sync link copied to clipboard.')
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = link
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.append(textArea)
      textArea.select()
      document.execCommand('copy')
      textArea.remove()
      setSyncMessage('Sync link copied to clipboard.')
    }
  }

  const handleDisableSyncThisDevice = () => {
    const current = questStateRef.current
    const nextState: QuestboardState = {
      ...current,
      sync: {
        ...DEFAULT_SYNC_CONFIG,
        deviceId: current.sync.deviceId || createDeviceId(),
      },
    }
    persistState(nextState, 'sync-system')
    setSyncStatus('not-enabled')
    setSyncMessage('Sync disabled on this device.')
    setSyncPanelOpen(false)
    setPendingConflict(null)
    dirtySincePullRef.current = false
  }

  const handleSaveReminder = () => {
    void downloadReminderIcs(questState.config, REMINDER_APP_LINK)
    const nextState: QuestboardState = { ...questState, reminderSaved: true }
    persistState(nextState)
  }

  const handleWeeklySubmit = (entry: WeeklyLogEntry) => {
    const cleaned = {
      debt: clampNonNegative(entry.debt),
      savings: clampNonNegative(entry.savings),
      tracks: clampNonNegative(entry.tracks),
      requiredSpend: clampNonNegative(entry.requiredSpend),
      discretionarySpend: clampNonNegative(entry.discretionarySpend),
      note: (entry.note ?? '').trim(),
    }

    const current = questState.appState
    const now = new Date()
    const nowWeekKey = getWeekKey(now)
    const existingLogs = current.logs

    const existingDerived = recalculateProgressFromLogs(existingLogs)
    const baseline = {
      current: {
        debt: Math.max(0, current.current.debt - existingDerived.current.debt),
        savings: Math.max(0, current.current.savings - existingDerived.current.savings),
        tracks: Math.max(0, current.current.tracks - existingDerived.current.tracks),
      },
      spending: {
        required: Math.max(0, current.spending.required - existingDerived.spending.required),
        discretionary: Math.max(0, current.spending.discretionary - existingDerived.spending.discretionary),
      },
      streakWeeks: Math.max(0, current.streakWeeks - existingDerived.streakWeeks),
      financeXp: Math.max(0, current.financeXp - existingDerived.financeXp),
    }

    const matchingWeekLog = existingLogs.find((log) => log.weekKey === nowWeekKey)
    const activeLogId = entry.logId ?? matchingWeekLog?.id ?? null

    const oldLog = activeLogId ? existingLogs.find((log) => log.id === activeLogId) ?? null : null

    const monthlySpending = computeMonthSpendingFromLogs(existingLogs, now)
    const savingsTargets = computeSavingsTargets(questState.config.budgetPlan, current.current.savings, now)
    const budgetAvailability = computeBudgetAvailability(
      questState.config.budgetPlan,
      monthlySpending,
      now,
      current.current.savings,
    )

    const provisionalLog: FinanceLogEntry = {
      id: oldLog?.id ?? createLogId(),
      weekKey: oldLog?.weekKey ?? nowWeekKey,
      loggedAt: oldLog?.loggedAt ?? now.getTime(),
      debtPaid: cleaned.debt,
      savingsAdded: cleaned.savings,
      tracksMade: cleaned.tracks,
      requiredSpend: cleaned.requiredSpend,
      discretionarySpend: cleaned.discretionarySpend,
      note: cleaned.note,
      financeXp: 0,
    }

    const isOnTime = isLogOnTime(questState.config, provisionalLog.weekKey, provisionalLog.loggedAt)

    const financeXp = computeFinanceXp(provisionalLog, {
      weeklySavingsTarget: savingsTargets.weeklySavingsTarget,
      weeklyDiscretionaryBudget: budgetAvailability.weeklyDiscretionaryBudget,
      isOnTime,
    })

    const nextLog: FinanceLogEntry = {
      ...provisionalLog,
      financeXp,
    }

    const nextLogs = oldLog
      ? existingLogs.map((log) => (log.id === oldLog.id ? nextLog : log))
      : [...existingLogs, nextLog]

    const recalculated = recalculateProgressFromLogs(nextLogs)

    const before = {
      debt: current.current.debt,
      savings: current.current.savings,
      tracks: current.current.tracks,
      requiredSpend: current.spending.required,
      discretionarySpend: current.spending.discretionary,
    }

    const nextAppState: QuestboardState['appState'] = {
      ...current,
      current: {
        debt: baseline.current.debt + recalculated.current.debt,
        savings: baseline.current.savings + recalculated.current.savings,
        tracks: baseline.current.tracks + recalculated.current.tracks,
      },
      spending: {
        required: baseline.spending.required + recalculated.spending.required,
        discretionary: baseline.spending.discretionary + recalculated.spending.discretionary,
      },
      streakWeeks: baseline.streakWeeks + recalculated.streakWeeks,
      financeXp: baseline.financeXp + recalculated.financeXp,
      logs: nextLogs.sort((a, b) => a.loggedAt - b.loggedAt),
    }

    const debtPct = computeProgressPct(nextAppState.current.debt, nextAppState.targets.debt)
    const tracksPct = computeProgressPct(nextAppState.current.tracks, nextAppState.targets.tracks)

    let suggestionTag: RecapData['suggestionTag'] = 'EVEN'
    let suggestionText = 'Balanced progress. Close this and wait for the next reminder.'

    if (tracksPct < debtPct) {
      suggestionTag = 'TRACKS'
      suggestionText = 'Tracks are the bottleneck. Protect one focused session before midweek.'
    } else if (debtPct < tracksPct) {
      suggestionTag = 'DEBT'
      suggestionText = 'Debt pace is trailing. Set one automatic payment to remove friction.'
    }

    const savingsAfter = computeSavingsTargets(questState.config.budgetPlan, nextAppState.current.savings, now)
    const financeVerdict: RecapData['financeVerdict'] =
      savingsAfter.projectedGap > 0 ? 'CATCH-UP NEEDED' : 'ON PACE'

    if (financeVerdict === 'CATCH-UP NEEDED') {
      suggestionTag = 'FINANCE'
      suggestionText =
        savingsAfter.projectedGap >= savingsAfter.weeklySavingsTarget
          ? 'Savings pace is over a week behind. Reduce discretionary spend or add one extra transfer this week.'
          : 'Savings pace is slightly behind. Make one small catch-up transfer this week.'
    }

    const nextState: QuestboardState = { ...questState, appState: nextAppState }
    setPendingState(nextState)
    setRecap({
      before,
      after: {
        debt: nextAppState.current.debt,
        savings: nextAppState.current.savings,
        tracks: nextAppState.current.tracks,
        requiredSpend: nextAppState.spending.required,
        discretionarySpend: nextAppState.spending.discretionary,
      },
      streakWeeks: nextAppState.streakWeeks,
      score: computeScore(nextAppState),
      suggestionTag,
      suggestionText,
      financeVerdict,
      financeXpEarned: financeXp,
    })
  }

  const closeRecap = () => {
    if (pendingState) {
      persistState(pendingState)
      setPendingState(null)
    }
    setRecap(null)
  }

  const closeWalkthrough = () => {
    setWalkthroughOpen(false)
    setWalkthroughStep(1)
    setWalkthroughOpenSource(null)
  }

  const openWalkthrough = (source: WalkthroughOpenSource) => {
    setWalkthroughOpenSource(source)
    setWalkthroughStep(1)
    setWalkthroughOpen(true)

    if (source === 'manual') {
      emitTelemetry('finance_walkthrough_manual_open', { version: FINANCE_WALKTHROUGH_VERSION })
    }
  }

  const skipWalkthrough = () => {
    const source = walkthroughOpenSource ?? 'manual'
    const step = walkthroughStep
    closeWalkthrough()

    if (source === 'auto') {
      markWalkthroughSkipped(FINANCE_WALKTHROUGH_VERSION)
    }

    emitTelemetry('finance_walkthrough_skipped', {
      version: FINANCE_WALKTHROUGH_VERSION,
      source,
      step,
    })
  }

  const completeWalkthrough = () => {
    const source = walkthroughOpenSource ?? 'manual'
    closeWalkthrough()
    markWalkthroughCompleted(FINANCE_WALKTHROUGH_VERSION)
    emitTelemetry('finance_walkthrough_completed', {
      version: FINANCE_WALKTHROUGH_VERSION,
      source,
    })
  }

  const enterDashboard = () => {
    setScreen('dashboard')
    if (walkthroughAutoShownThisSessionRef.current) {
      return
    }
    if (!shouldShowWalkthrough(FINANCE_WALKTHROUGH_VERSION)) {
      return
    }

    walkthroughAutoShownThisSessionRef.current = true
    markWalkthroughShown(FINANCE_WALKTHROUGH_VERSION)
    openWalkthrough('auto')
    emitTelemetry('finance_walkthrough_shown', { version: FINANCE_WALKTHROUGH_VERSION })
  }

  const walkthroughTarget: WalkthroughTarget | null =
    !walkthroughOpen ? null : walkthroughStep <= 2 ? 'log' : walkthroughStep === 3 ? 'monthly' : 'calendar'

  const activeWalkthrough = walkthroughContent[Math.max(0, walkthroughStep - 1)]
  const syncLink = questState.sync.enabled ? getSyncLink(questState.sync.vaultId, questState.sync.syncKey) : null

  const weeklyOverdue = isWeeklyLogOverdue(questState.config, questState.appState.logs)
  const currentSavingsTargets = computeSavingsTargets(questState.config.budgetPlan, questState.appState.current.savings)
  const paceAlertLevel: 'urgent' | 'caution' | null =
    currentSavingsTargets.projectedGap >= currentSavingsTargets.weeklySavingsTarget &&
    currentSavingsTargets.projectedGap > 0
      ? 'urgent'
      : currentSavingsTargets.projectedGap > 0
        ? 'caution'
        : null

  const paceAlertMessage =
    paceAlertLevel === 'urgent'
      ? `Projected year-end shortfall is ${Math.round(
          currentSavingsTargets.projectedGap,
        )}, at least one weekly target behind.`
      : paceAlertLevel === 'caution'
        ? `Projected year-end shortfall is ${Math.round(
            currentSavingsTargets.projectedGap,
          )}. Small catch-up recommended this week.`
        : ''

  const onKeepLocal = () => {
    const conflict = pendingConflict
    if (!conflict) {
      return
    }

    setPendingConflict(null)
    void performPush({
      manual: true,
      forceRevision: conflict.cloud.revision,
      overrideState: questStateRef.current,
    })
  }

  const onUseCloud = () => {
    const conflict = pendingConflict
    if (!conflict) {
      return
    }

    setPendingConflict(null)
    applyPulledState(conflict.cloud, conflict.credentials, 'sync-pull', 'Applied cloud version.')
  }

  return (
    <>
      <WindowShell clock={clock}>
        {screen === 'setup' && (
          <SetupScreen
            config={questState.config}
            currentSavings={questState.appState.current.savings}
            onContinue={handleSetupContinue}
            syncAvailable={syncAvailable}
            syncEnabled={questState.sync.enabled}
            syncStatusLabel={syncStatusLabel(syncStatus)}
            syncMessage={syncMessage}
            syncLink={syncLink}
            onEnableSync={() => {
              void handleEnableSync()
            }}
            onCopySyncLink={() => {
              void handleCopySyncLink()
            }}
          />
        )}

        {screen === 'reminder' && (
          <ReminderScreen
            config={questState.config}
            reminderSaved={questState.reminderSaved}
            onBack={() => setScreen('setup')}
            onSaveReminder={handleSaveReminder}
            onEnterDashboard={enterDashboard}
          />
        )}

        {screen === 'dashboard' && (
          <DashboardScreen
            config={questState.config}
            appState={questState.appState}
            highlightTarget={walkthroughTarget}
            onSubmitLog={handleWeeklySubmit}
            onOpenWhatsNew={() => openWalkthrough('manual')}
            onOpenReminder={() => setScreen('reminder')}
            onOpenSync={() => setSyncPanelOpen(true)}
            syncStatusLabel={syncStatusLabel(syncStatus)}
            syncEnabled={questState.sync.enabled}
            weeklyOverdue={weeklyOverdue}
            paceAlert={{
              level: paceAlertLevel,
              message: paceAlertMessage,
            }}
          />
        )}
      </WindowShell>

      <WalkthroughOverlay
        show={walkthroughOpen}
        step={walkthroughStep}
        totalSteps={walkthroughContent.length}
        title={activeWalkthrough?.title ?? ''}
        description={activeWalkthrough?.description ?? ''}
        buttonLabel={activeWalkthrough?.button ?? 'Next →'}
        onSkip={skipWalkthrough}
        onNext={() => {
          if (walkthroughStep >= walkthroughContent.length) {
            completeWalkthrough()
            return
          }
          setWalkthroughStep((step) => step + 1)
        }}
      />

      <SyncPanel
        show={syncPanelOpen}
        syncEnabled={questState.sync.enabled}
        syncStatusLabel={syncStatusLabel(syncStatus)}
        syncMessage={syncMessage}
        onClose={() => setSyncPanelOpen(false)}
        onCopySyncLink={() => {
          void handleCopySyncLink()
        }}
        onPullNow={() => {
          void performPull({ manual: true })
        }}
        onPushNow={() => {
          void performPush({ manual: true })
        }}
        onDisableThisDevice={handleDisableSyncThisDevice}
      />

      <SyncConflictOverlay
        show={pendingConflict !== null}
        onKeepLocal={onKeepLocal}
        onUseCloud={onUseCloud}
        onDismiss={() => setPendingConflict(null)}
      />

      <RecapOverlay recap={recap} onClose={closeRecap} />
    </>
  )
}

export default App
