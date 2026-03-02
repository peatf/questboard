import { useEffect, useMemo, useState } from 'react'
import { DashboardScreen } from './components/DashboardScreen'
import { RecapOverlay, type RecapData } from './components/RecapOverlay'
import { ReminderScreen } from './components/ReminderScreen'
import { SetupScreen } from './components/SetupScreen'
import { WalkthroughOverlay } from './components/WalkthroughOverlay'
import { WindowShell } from './components/WindowShell'
import {
  clampNonNegative,
  computeProgressPct,
  computeScore,
  downloadReminderIcs,
  formatClock,
  isWalkthroughComplete,
  loadQuestboardState,
  saveQuestboardState,
  setWalkthroughComplete,
  type QuestboardState,
  type WalkthroughTarget,
  type WeeklyLogEntry,
} from './state'

type Screen = 'setup' | 'reminder' | 'dashboard'

function App() {
  const [questState, setQuestState] = useState<QuestboardState>(() => loadQuestboardState())
  const [screen, setScreen] = useState<Screen>('setup')
  const [clock, setClock] = useState<string>(() => formatClock(new Date()))

  const [walkthroughOpen, setWalkthroughOpen] = useState(false)
  const [walkthroughStep, setWalkthroughStep] = useState(1)

  const [pendingState, setPendingState] = useState<QuestboardState | null>(null)
  const [recap, setRecap] = useState<RecapData | null>(null)

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()))
    tick()
    const timer = window.setInterval(tick, 10000)
    return () => window.clearInterval(timer)
  }, [])

  const walkthroughContent = useMemo(
    () => [
      {
        title: 'Log Weekly',
        description: 'Once per week, enter debt, savings, and tracks. That is the only required input.',
        button: 'Next →',
      },
      {
        title: 'Watch Monthly Objectives',
        description: 'Use the bars and pace signal to stay aligned with your monthly minimum targets.',
        button: 'Next →',
      },
      {
        title: 'Obey the Calendar Rule',
        description: "Don't open randomly. Open from the reminder event, log once, then close.",
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
    setQuestState(nextState)
    saveQuestboardState(nextState)
    setScreen('reminder')
  }

  const handleSaveReminder = () => {
    downloadReminderIcs(questState.config, window.location.href)
    const nextState: QuestboardState = { ...questState, reminderSaved: true }
    setQuestState(nextState)
    saveQuestboardState(nextState)
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
    let suggestionText = 'Balanced progress. Close the window and wait for the next calendar event.'

    if (tracksPct < debtPct) {
      suggestionTag = 'TRACKS'
      suggestionText = 'Tracks are the limiting factor. Protect one focused session before midweek.'
    } else if (debtPct < tracksPct) {
      suggestionTag = 'DEBT'
      suggestionText = 'Debt pacing is trailing. Find one automatic payment move to remove friction.'
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
      setQuestState(pendingState)
      saveQuestboardState(pendingState)
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

  return (
    <>
      <WindowShell clock={clock}>
        {screen === 'setup' && <SetupScreen config={questState.config} onContinue={handleSetupContinue} />}

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

      <RecapOverlay recap={recap} onClose={closeRecap} />
    </>
  )
}

export default App
