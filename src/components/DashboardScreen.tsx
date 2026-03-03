import { useState, type FormEvent } from 'react'
import {
  computeBudgetAvailability,
  computeLevel,
  computeMonthSpendingFromLogs,
  computeProgressPct,
  computeRank,
  computeSavingsTargets,
  computeScore,
  evaluatePurchaseDecision,
  formatMoney,
  getStreakTag,
  getTactics,
  getWeekKey,
  monthInfo,
  paceTag,
  type AppProgressState,
  type PurchaseDecisionResult,
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
  onOpenWhatsNew: () => void
  syncStatusLabel: string
  syncEnabled: boolean
  weeklyOverdue: boolean
  paceAlert: {
    level: 'urgent' | 'caution' | null
    message: string
  }
}

type CommandTab = 'log' | 'targets' | 'tactics' | 'finance'
type BuyTiming = 'now' | 'this-week' | 'this-month'

interface FormValues {
  debt: string
  savings: string
  tracks: string
  requiredSpend: string
  discretionarySpend: string
  note: string
  logId: string | null
}

const EMPTY_FORM: FormValues = {
  debt: '',
  savings: '',
  tracks: '',
  requiredSpend: '',
  discretionarySpend: '',
  note: '',
  logId: null,
}

export function DashboardScreen({
  config,
  appState,
  highlightTarget,
  onSubmitLog,
  onOpenReminder,
  onOpenSync,
  onOpenWhatsNew,
  syncStatusLabel,
  syncEnabled,
  weeklyOverdue,
  paceAlert,
}: DashboardScreenProps) {
  const [commandTab, setCommandTab] = useState<CommandTab>('log')
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM)
  const [buyCost, setBuyCost] = useState('')
  const [buyName, setBuyName] = useState('')
  const [buyTiming, setBuyTiming] = useState<BuyTiming>('now')
  const [buyResult, setBuyResult] = useState<PurchaseDecisionResult | null>(null)

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

  const savingsTargets = computeSavingsTargets(config.budgetPlan, appState.current.savings)
  const monthSpending = computeMonthSpendingFromLogs(appState.logs)

  const budgetAvailability = computeBudgetAvailability(
    config.budgetPlan,
    monthSpending,
    new Date(),
    appState.current.savings,
  )

  const weekKey = getWeekKey(new Date())
  const weeklyDiscretionarySpent = appState.logs
    .filter((entry) => entry.weekKey === weekKey)
    .reduce((sum, entry) => sum + entry.discretionarySpend, 0)

  const weeklyDiscretionaryRemaining = Math.max(0, budgetAvailability.weeklyDiscretionaryBudget - weeklyDiscretionarySpent)

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
      requiredSpend: Number(formValues.requiredSpend) || 0,
      discretionarySpend: Number(formValues.discretionarySpend) || 0,
      note: formValues.note,
      logId: formValues.logId ?? undefined,
    })
    setFormValues(EMPTY_FORM)
  }

  const startEdit = (logId: string) => {
    const target = appState.logs.find((entry) => entry.id === logId)
    if (!target) {
      return
    }

    setCommandTab('log')
    setFormValues({
      debt: String(target.debtPaid),
      savings: String(target.savingsAdded),
      tracks: String(target.tracksMade),
      requiredSpend: String(target.requiredSpend),
      discretionarySpend: String(target.discretionarySpend),
      note: target.note,
      logId: target.id,
    })
    scrollToCard('card-log', 'log')
  }

  const runBuyCheck = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const discretionaryBudgetRemaining =
      buyTiming === 'this-month'
        ? budgetAvailability.discretionaryRemainingThisMonth
        : weeklyDiscretionaryRemaining

    setBuyResult(
      evaluatePurchaseDecision(
        {
          cost: Number(buyCost) || 0,
          timing: buyTiming,
          itemName: buyName,
        },
        {
          discretionaryBudgetRemaining,
          weeklySavingsTarget: savingsTargets.weeklySavingsTarget,
          projectedYearEndSavings: savingsTargets.projectedYearEndSavings,
          eoySavingsGoal: config.budgetPlan.eoySavingsGoal,
        },
      ),
    )
  }

  const savingsGapTagClass =
    savingsTargets.projectedGap >= savingsTargets.weeklySavingsTarget && savingsTargets.projectedGap > 0
      ? 'bad'
      : savingsTargets.projectedGap > 0
        ? 'warn'
        : 'good'

  const history = [...appState.logs].sort((a, b) => b.loggedAt - a.loggedAt)

  return (
    <section id="screen-dashboard">
      {(weeklyOverdue || paceAlert.level) && (
        <div className="stack-16 card-gap">
          {weeklyOverdue && (
            <div className="bevel-out panel panel-tight finance-alert finance-alert-caution">
              <div className="row">
                <div className="kicker">Weekly Reminder</div>
                <div className="tag warn">OVERDUE</div>
              </div>
              <p className="sub sub-top-16">This week is past your check-in time. Log spending and savings now.</p>
            </div>
          )}

          {paceAlert.level && (
            <div
              className={`bevel-out panel panel-tight finance-alert ${
                paceAlert.level === 'urgent' ? 'finance-alert-urgent' : 'finance-alert-caution'
              }`}
            >
              <div className="row">
                <div className="kicker">Savings Pace Alert</div>
                <div className={`tag ${paceAlert.level === 'urgent' ? 'bad' : 'warn'}`}>
                  {paceAlert.level === 'urgent' ? 'URGENT' : 'CAUTION'}
                </div>
              </div>
              <p className="sub sub-top-16">{paceAlert.message}</p>
            </div>
          )}
        </div>
      )}

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
              className={`cmd-btn ${commandTab === 'finance' ? 'active' : ''}`}
              onClick={() => scrollToCard('card-finance', 'finance')}
              type="button"
            >
              FINANCE
            </button>
            <button
              className={`cmd-btn ${commandTab === 'tactics' ? 'active' : ''}`}
              onClick={() => scrollToCard('card-tactics', 'tactics')}
              type="button"
            >
              TACTICS
            </button>
            <button className="cmd-btn" onClick={onOpenWhatsNew} type="button">
              WHAT&apos;S NEW
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

              <div className="grid-2">
                <div>
                  <label htmlFor="input-required">Required spend</label>
                  <input
                    id="input-required"
                    className="input-mono"
                    type="number"
                    min={0}
                    required
                    placeholder="0"
                    value={formValues.requiredSpend}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, requiredSpend: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label htmlFor="input-discretionary">Fun spend</label>
                  <input
                    id="input-discretionary"
                    className="input-mono"
                    type="number"
                    min={0}
                    required
                    placeholder="0"
                    value={formValues.discretionarySpend}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, discretionarySpend: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label htmlFor="input-note">Note (optional)</label>
                <input
                  id="input-note"
                  type="text"
                  value={formValues.note}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="Big purchase, unusual week, or exception"
                />
              </div>

              <div className="row row-end">
                {formValues.logId && (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setFormValues(EMPTY_FORM)
                    }}
                  >
                    Cancel edit
                  </button>
                )}
                <button className="btn btn-primary" type="submit">
                  {formValues.logId ? 'Update log →' : 'Save log →'}
                </button>
              </div>
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

          <div
            id="card-finance"
            className={`bevel-out panel stack-24 card-gap ${
              highlightTarget === 'finance' ? 'walkthrough-highlight' : ''
            }`}
          >
            <div>
              <div className="kicker">Savings Pace</div>
              <h2 className="h1 h1-sm pad-top-8">Year-end mission tracking</h2>
            </div>

            <div className="bevel-in panel panel-tight stack-16">
              <div className="row">
                <div className="muted">Weekly target</div>
                <div className="mono">{formatMoney(savingsTargets.weeklySavingsTarget)}</div>
              </div>
              <div className="row">
                <div className="muted">Monthly target</div>
                <div className="mono">{formatMoney(savingsTargets.monthlySavingsTarget)}</div>
              </div>
              <div className="row">
                <div className="muted">Remaining to goal</div>
                <div className="mono">{formatMoney(savingsTargets.remainingGoal)}</div>
              </div>
              <div className="row">
                <div className="muted">Projected year-end</div>
                <div className="mono">{formatMoney(savingsTargets.projectedYearEndSavings)}</div>
              </div>
              <div className="row">
                <div className="muted">Projected gap</div>
                <div className={`tag ${savingsGapTagClass}`}>{formatMoney(savingsTargets.projectedGap)}</div>
              </div>
            </div>

            <div className="bevel-in panel panel-tight stack-16">
              <div className="kicker">Spending Snapshot</div>
              <div className="row">
                <div className="muted">Required spend this month</div>
                <div className="mono">{formatMoney(monthSpending.required)}</div>
              </div>
              <div className="row">
                <div className="muted">Fun spend this month</div>
                <div className="mono">{formatMoney(monthSpending.discretionary)}</div>
              </div>
              <div className="row">
                <div className="muted">Monthly fun budget</div>
                <div className="mono">{formatMoney(budgetAvailability.monthlyDiscretionaryBudget)}</div>
              </div>
              <div className="row">
                <div className="muted">Weekly fun budget</div>
                <div className="mono">{formatMoney(budgetAvailability.weeklyDiscretionaryBudget)}</div>
              </div>
            </div>

            <div className="bevel-in panel panel-tight stack-24">
              <div>
                <div className="kicker">Can I buy this right now?</div>
                <p className="sub">Enter the cost and timing. System returns Yes, Caution, or No with impact.</p>
              </div>

              <form className="stack-16" onSubmit={runBuyCheck}>
                <div className="grid-2">
                  <div>
                    <label htmlFor="buy-name">Item (optional)</label>
                    <input
                      id="buy-name"
                      type="text"
                      value={buyName}
                      onChange={(event) => setBuyName(event.target.value)}
                      placeholder="Headphones"
                    />
                  </div>
                  <div>
                    <label htmlFor="buy-cost">Cost</label>
                    <input
                      id="buy-cost"
                      className="input-mono"
                      type="number"
                      min={0}
                      required
                      value={buyCost}
                      onChange={(event) => setBuyCost(event.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="buy-timing">Timing</label>
                  <select
                    id="buy-timing"
                    value={buyTiming}
                    onChange={(event) => setBuyTiming(event.target.value as BuyTiming)}
                  >
                    <option value="now">Now</option>
                    <option value="this-week">This week</option>
                    <option value="this-month">This month</option>
                  </select>
                </div>

                <button className="btn btn-primary" type="submit">
                  Check purchase →
                </button>
              </form>

              {buyResult && (
                <div className="bevel-out panel panel-tight stack-16">
                  <div className="row">
                    <div className="mono next-action">Decision</div>
                    <div
                      className={`tag ${
                        buyResult.verdict === 'YES'
                          ? 'good'
                          : buyResult.verdict === 'CAUTION'
                            ? 'warn'
                            : 'bad'
                      }`}
                    >
                      {buyResult.verdict}
                    </div>
                  </div>
                  <p className="sub">{buyResult.reason}</p>
                  <div className="row">
                    <div className="muted">Discretionary after purchase</div>
                    <div className="mono">{formatMoney(buyResult.impact.discretionaryRemainingAfter)}</div>
                  </div>
                  <div className="row">
                    <div className="muted">Projected year-end after purchase</div>
                    <div className="mono">{formatMoney(buyResult.impact.projectedYearEndAfter)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bevel-out panel stack-24 card-gap" id="card-history">
            <div className="row">
              <div>
                <div className="kicker">Weekly History</div>
                <h2 className="h1 h1-sm pad-top-8">Editable log history</h2>
              </div>
              <div className="tag">{`${history.length} entries`}</div>
            </div>

            {history.length === 0 && <p className="sub">No weekly logs yet.</p>}

            {history.length > 0 && (
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Savings</th>
                      <th>Fun</th>
                      <th>Req.</th>
                      <th>Debt</th>
                      <th>Tracks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id}>
                        <td data-label="Date">{new Date(entry.loggedAt).toLocaleDateString()}</td>
                        <td data-label="Savings">{formatMoney(entry.savingsAdded)}</td>
                        <td data-label="Fun">{formatMoney(entry.discretionarySpend)}</td>
                        <td data-label="Required">{formatMoney(entry.requiredSpend)}</td>
                        <td data-label="Debt">{formatMoney(entry.debtPaid)}</td>
                        <td data-label="Tracks">{entry.tracksMade}</td>
                        <td data-label="Action">
                          <button className="btn btn-small" type="button" onClick={() => startEdit(entry.id)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
