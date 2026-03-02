import { useState, type FormEvent } from 'react'
import {
  computeLevel,
  computeProgressPct,
  computeRank,
  computeScore,
  formatMoney,
  getStreakTag,
  getTactics,
  monthInfo,
  paceTag,
  type AppProgressState,
  type QuestConfig,
  type WalkthroughTarget,
  type WeeklyLogEntry,
} from '../state'

interface DashboardScreenProps {
  config: QuestConfig
  appState: AppProgressState
  highlightTarget: WalkthroughTarget | null
  onSubmitLog: (entry: WeeklyLogEntry) => void
  onOpenReminder: () => void
  onOpenSync: () => void
  syncStatusLabel: string
  syncEnabled: boolean
}

type CommandTab = 'log' | 'targets' | 'tactics'

export function DashboardScreen({
  config,
  appState,
  highlightTarget,
  onSubmitLog,
  onOpenReminder,
  onOpenSync,
  syncStatusLabel,
  syncEnabled,
}: DashboardScreenProps) {
  const [commandTab, setCommandTab] = useState<CommandTab>('log')
  const [formValues, setFormValues] = useState({ debt: '', savings: '', tracks: '' })

  const month = monthInfo()
  const debtPct = computeProgressPct(appState.current.debt, appState.targets.debt)
  const tracksPct = computeProgressPct(appState.current.tracks, appState.targets.tracks)
  const objectivePct = Math.min(debtPct, tracksPct)

  const score = computeScore(appState)
  const level = computeLevel(score)
  const rank = computeRank(score)
  const pace = paceTag(objectivePct, month.expectedPct)

  const tactics = getTactics(debtPct, tracksPct, month.expectedPct)
  const weekStamp = new Date().toLocaleDateString(undefined, { month: 'short', day: '2-digit' })

  const scrollToCard = (id: string, tab: CommandTab) => {
    setCommandTab(tab)
    const card = document.getElementById(id)
    if (!card) {
      return
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmitLog({
      debt: Number(formValues.debt) || 0,
      savings: Number(formValues.savings) || 0,
      tracks: Number(formValues.tracks) || 0,
    })
    setFormValues({ debt: '', savings: '', tracks: '' })
  }

  return (
    <section id="screen-dashboard">
      <div className="row top-row">
        <div>
          <div className="kicker">Operator</div>
          <div className="h1 h1-sm" id="dash-player">
            {config.name}
          </div>
        </div>

        <div className="align-right">
          <div className="kicker">Month resets in</div>
          <div className="mono mono-strong" id="dash-daysleft">{`${month.daysLeft} days`}</div>
        </div>
      </div>

      <div className="hud">
        <div className="kpi">
          <div className="k">Level</div>
          <div className="v">{level}</div>
          <div className="tag">{rank.name}</div>
        </div>

        <div className="kpi">
          <div className="k">Streak</div>
          <div className="v">{`${appState.streakWeeks}w`}</div>
          <div className="tag">{getStreakTag(appState.streakWeeks)}</div>
        </div>

        <div className="kpi">
          <div className="k">Month Score</div>
          <div className="v mono">{score}</div>
          <div className="tag">{rank.nextAt ? `NEXT: ${rank.nextAt}` : 'MAX'}</div>
        </div>

        <div className="kpi">
          <div className="k">Pace</div>
          <div className="v">{pace.label}</div>
          <div className={`tag ${pace.className}`}>{`${Math.round(objectivePct)}% vs ${Math.round(
            month.expectedPct,
          )}%`}</div>
        </div>
      </div>

      <div className="dash">
        <aside className="bevel-out cmd">
          <div className="row cmd-head">
            <div className="cmd-title">Command Menu</div>
            {syncEnabled && <div className="tag">{syncStatusLabel}</div>}
          </div>
          <div className="cmd-strip">
            <button
              className={`cmd-btn ${commandTab === 'log' ? 'active' : ''}`}
              onClick={() => scrollToCard('card-log', 'log')}
              type="button"
            >
              LOG WEEK
            </button>
            <button
              className={`cmd-btn ${commandTab === 'targets' ? 'active' : ''}`}
              onClick={() => scrollToCard('card-monthly', 'targets')}
              type="button"
            >
              TARGETS
            </button>
            <button
              className={`cmd-btn ${commandTab === 'tactics' ? 'active' : ''}`}
              onClick={() => scrollToCard('card-tactics', 'tactics')}
              type="button"
            >
              TACTICS
            </button>
            <button className="cmd-btn" onClick={onOpenReminder} type="button">
              REMINDERS
            </button>
            <button className="cmd-btn" onClick={onOpenSync} type="button">
              SYNC
            </button>
          </div>
        </aside>

        <main>
          <div
            id="card-log"
            className={`bevel-out panel stack-24 card-gap ${
              highlightTarget === 'log' ? 'walkthrough-highlight' : ''
            }`}
          >
            <div className="row">
              <div>
                <div className="kicker">Weekly Check-in</div>
                <h2 className="h1 h1-sm pad-top-8">Log the numbers</h2>
              </div>
              <div className="mono muted mono-small">{weekStamp}</div>
            </div>

            <form id="log-form" onSubmit={handleSubmit} className="stack-24">
              <div className="grid-3">
                <div>
                  <label htmlFor="input-debt">Debt Paid</label>
                  <input
                    id="input-debt"
                    className="input-mono"
                    type="number"
                    min={0}
                    required
                    placeholder="0"
                    value={formValues.debt}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, debt: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label htmlFor="input-savings">Savings Added</label>
                  <input
                    id="input-savings"
                    className="input-mono"
                    type="number"
                    min={0}
                    required
                    placeholder="0"
                    value={formValues.savings}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, savings: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label htmlFor="input-tracks">Tracks Made</label>
                  <input
                    id="input-tracks"
                    className="input-mono"
                    type="number"
                    min={0}
                    required
                    placeholder="0"
                    value={formValues.tracks}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, tracks: event.target.value }))
                    }
                  />
                </div>
              </div>

              <button className="btn btn-primary" type="submit">
                Save log →
              </button>
              <p
                id="calendar-rule"
                className={`sub ${highlightTarget === 'calendar' ? 'walkthrough-highlight-inline' : ''}`}
              >
                Rule: log once a week from the reminder, then close.
              </p>
            </form>
          </div>

          <div
            id="card-monthly"
            className={`bevel-out panel stack-24 card-gap ${
              highlightTarget === 'monthly' ? 'walkthrough-highlight' : ''
            }`}
          >
            <div className="row">
              <div>
                <div className="kicker">Monthly Targets</div>
                <h2 className="h1 h1-sm pad-top-8">Minimums and pace</h2>
              </div>
              <div className="mono muted mono-small">{`Debt $${appState.targets.debt} · Tracks ${appState.targets.tracks}`}</div>
            </div>

            <div className="stack-16">
              <div className="row">
                <div className="muted">Debt</div>
                <div className="mono">{`${formatMoney(appState.current.debt)} / ${formatMoney(
                  appState.targets.debt,
                )}`}</div>
              </div>
              <div className="bar">
                <i style={{ width: `${debtPct}%` }} />
              </div>

              <div className="row bar-label">
                <div className="muted">Tracks</div>
                <div className="mono">{`${appState.current.tracks} / ${appState.targets.tracks}`}</div>
              </div>
              <div className="bar purple">
                <i style={{ width: `${tracksPct}%` }} />
              </div>

              <div className="hr" />

              <div className="row">
                <div className="muted">Total Savings</div>
                <div className="mono">{formatMoney(appState.current.savings)}</div>
              </div>
            </div>
          </div>

          <div id="card-tactics" className="bevel-out panel stack-24">
            <div>
              <div className="kicker">Tactics</div>
              <h2 className="h1 h1-sm pad-top-8">One move this week</h2>
              <p className="sub">{tactics.text}</p>
            </div>

            <div className="bevel-in panel panel-tight">
              <div className="row">
                <div className="mono next-action">Next action</div>
                <div className="tag">{tactics.tag}</div>
              </div>
              <p className="sub sub-top-16">{tactics.action}</p>
            </div>
          </div>
        </main>
      </div>
    </section>
  )
}
