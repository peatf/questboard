import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DashboardScreen } from './components/DashboardScreen'
import { RecapOverlay, type RecapData } from './components/RecapOverlay'
import { ReminderScreen } from './components/ReminderScreen'
import { SetupScreen } from './components/SetupScreen'
import { SyncConflictOverlay, SyncPanel } from './components/SyncPanel'
import { WalkthroughOverlay } from './components/WalkthroughOverlay'
import { WindowShell } from './components/WindowShell'
import {
  QUESTBOARD_STATE_SAVED_EVENT,
  DEFAULT_SYNC_CONFIG,
  clearProgressState,
  clampNonNegative,
  computeProgressPct,
  computeScore,
  downloadReminderIcs,
  formatClock,
  isLegacyDemoSeedState,
  isWalkthroughComplete,
  loadQuestboardState,
  saveQuestboardState,
  setWalkthroughComplete,
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

function App() {
  const [questState, setQuestState] = useState<QuestboardState>(() => loadQuestboardState())
  const [screen, setScreen] = useState<Screen>('setup')
  const [clock, setClock] = useState<string>(() => formatClock(new Date()))

  const [walkthroughOpen, setWalkthroughOpen] = useState(false)
  const [walkthroughStep, setWalkthroughStep] = useState(1)

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
        schemaVersion: 2,
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

  const walkthroughContent = useMemo(
    () => [
      {
        title: 'Log weekly',
        description: "Once per week, enter debt, savings, and tracks. That's the only required input.",
        button: 'Next →',
      },
      {
        title: 'Watch monthly targets',
        description: 'Use the bars and pace signal to stay on your monthly minimum targets.',
        button: 'Next →',
      },
      {
        title: 'Follow the calendar rule',
        description: 'Open from the reminder event, log once, then close.',
        button: 'Start →',
      },
    ],
    [],
  )

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
    }

    const before = { ...questState.appState.current }
    const nextAppState: QuestboardState['appState'] = {
      ...questState.appState,
      current: {
        debt: questState.appState.current.debt + cleaned.debt,
        savings: questState.appState.current.savings + cleaned.savings,
        tracks: questState.appState.current.tracks + cleaned.tracks,
      },
      streakWeeks: (questState.appState.streakWeeks || 0) + 1,
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

    const nextState: QuestboardState = { ...questState, appState: nextAppState }
    setPendingState(nextState)
    setRecap({
      before,
      after: { ...nextAppState.current },
      streakWeeks: nextAppState.streakWeeks,
      score: computeScore(nextAppState),
      suggestionTag,
      suggestionText,
    })
  }

  const closeRecap = () => {
    if (pendingState) {
      persistState(pendingState)
      setPendingState(null)
    }
    setRecap(null)
  }

  const completeWalkthrough = () => {
    setWalkthroughOpen(false)
    setWalkthroughStep(1)
    setWalkthroughComplete()
  }

  const enterDashboard = () => {
    setScreen('dashboard')
    if (isWalkthroughComplete()) {
      return
    }
    setWalkthroughStep(1)
    setWalkthroughOpen(true)
  }

  const walkthroughTarget: WalkthroughTarget | null =
    !walkthroughOpen ? null : walkthroughStep === 1 ? 'log' : walkthroughStep === 2 ? 'monthly' : 'calendar'

  const activeWalkthrough = walkthroughContent[Math.max(0, walkthroughStep - 1)]
  const syncLink = questState.sync.enabled ? getSyncLink(questState.sync.vaultId, questState.sync.syncKey) : null

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
            onOpenReminder={() => setScreen('reminder')}
            onOpenSync={() => setSyncPanelOpen(true)}
            syncStatusLabel={syncStatusLabel(syncStatus)}
            syncEnabled={questState.sync.enabled}
          />
        )}
      </WindowShell>

      <WalkthroughOverlay
        show={walkthroughOpen}
        step={walkthroughStep}
        title={activeWalkthrough?.title ?? ''}
        description={activeWalkthrough?.description ?? ''}
        buttonLabel={activeWalkthrough?.button ?? 'Next →'}
        onSkip={completeWalkthrough}
        onNext={() => {
          if (walkthroughStep >= 3) {
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
