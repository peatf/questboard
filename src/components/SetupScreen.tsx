import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  clampNonNegative,
  computeBudgetAvailability,
  computeSavingsTargets,
  formatMoney,
  type QuestConfig,
} from '../state'

interface SetupScreenProps {
  config: QuestConfig
  currentSavings: number
  onContinue: (config: QuestConfig) => void
  syncAvailable: boolean
  syncEnabled: boolean
  syncStatusLabel: string
  syncMessage: string
  syncLink: string | null
  onEnableSync: () => void
  onCopySyncLink: () => void
}

export function SetupScreen({
  config,
  currentSavings,
  onContinue,
  syncAvailable,
  syncEnabled,
  syncStatusLabel,
  syncMessage,
  syncLink,
  onEnableSync,
  onCopySyncLink,
}: SetupScreenProps) {
  const [form, setForm] = useState<QuestConfig>(config)

  useEffect(() => {
    setForm(config)
  }, [config])

  const updateField = <K extends keyof QuestConfig>(key: K, value: QuestConfig[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const preview = useMemo(() => {
    const savingsTargets = computeSavingsTargets(form.budgetPlan, currentSavings)
    const availability = computeBudgetAvailability(form.budgetPlan, { required: 0, discretionary: 0 }, new Date(), currentSavings)
    return {
      weeklySavingsTarget: savingsTargets.weeklySavingsTarget,
      monthlySavingsTarget: savingsTargets.monthlySavingsTarget,
      weeklyDiscretionaryBudget: availability.weeklyDiscretionaryBudget,
    }
  }, [currentSavings, form.budgetPlan])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onContinue({
      ...form,
      name: form.name.trim() || 'Elias',
      trusted: form.trusted.trim(),
      targets: {
        debt: clampNonNegative(form.targets.debt),
        tracks: clampNonNegative(form.targets.tracks),
      },
      budgetPlan: {
        monthlyIncome: clampNonNegative(form.budgetPlan.monthlyIncome),
        monthlyFixedBills: clampNonNegative(form.budgetPlan.monthlyFixedBills),
        eoySavingsGoal: clampNonNegative(form.budgetPlan.eoySavingsGoal),
        goalYear: Math.max(new Date().getFullYear(), clampNonNegative(form.budgetPlan.goalYear)),
        goalStartAt: form.budgetPlan.goalStartAt,
      },
    })
  }

  return (
    <section id="screen-setup" className="stack-24">
      <div>
        <div className="kicker">System Setup</div>
        <h1 className="h1">Set your win conditions</h1>
        <p className="sub">Set targets and schedule once. After that: reminder pops, you log, you leave.</p>
      </div>

      <form className="stack-24" onSubmit={handleSubmit}>
        <div className="bevel-out panel stack-24">
          <div>
            <label htmlFor="cfg-name">Operator Name</label>
            <input
              id="cfg-name"
              type="text"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </div>

          <div className="grid-2">
            <div>
              <label htmlFor="cfg-day">Weekly check-in day</label>
              <select
                id="cfg-day"
                value={form.day}
                onChange={(event) => updateField('day', event.target.value as QuestConfig['day'])}
              >
                <option>Sunday</option>
                <option>Monday</option>
                <option>Tuesday</option>
                <option>Wednesday</option>
                <option>Thursday</option>
                <option>Friday</option>
                <option>Saturday</option>
              </select>
            </div>

            <div>
              <label htmlFor="cfg-time">Weekly check-in time</label>
              <input
                id="cfg-time"
                type="time"
                value={form.time}
                onChange={(event) => updateField('time', event.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div>
              <label htmlFor="cfg-debt">Monthly debt minimum</label>
              <input
                id="cfg-debt"
                className="input-mono"
                type="number"
                min={0}
                value={form.targets.debt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    targets: { ...current.targets, debt: Number(event.target.value) || 0 },
                  }))
                }
              />
            </div>

            <div>
              <label htmlFor="cfg-tracks">Monthly tracks minimum</label>
              <input
                id="cfg-tracks"
                className="input-mono"
                type="number"
                min={0}
                value={form.targets.tracks}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    targets: { ...current.targets, tracks: Number(event.target.value) || 0 },
                  }))
                }
              />
            </div>
          </div>

          <div className="bevel-in panel panel-tight stack-24">
            <div>
              <div className="kicker">Budget Mission</div>
              <p className="sub">Set your spending constraints and end-of-year savings objective.</p>
            </div>

            <div className="grid-2">
              <div>
                <label htmlFor="cfg-income">Monthly take-home income</label>
                <input
                  id="cfg-income"
                  className="input-mono"
                  type="number"
                  min={0}
                  value={form.budgetPlan.monthlyIncome}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      budgetPlan: {
                        ...current.budgetPlan,
                        monthlyIncome: Number(event.target.value) || 0,
                      },
                    }))
                  }
                />
              </div>

              <div>
                <label htmlFor="cfg-bills">Monthly fixed bills</label>
                <input
                  id="cfg-bills"
                  className="input-mono"
                  type="number"
                  min={0}
                  value={form.budgetPlan.monthlyFixedBills}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      budgetPlan: {
                        ...current.budgetPlan,
                        monthlyFixedBills: Number(event.target.value) || 0,
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label htmlFor="cfg-eoy-goal">End-of-year savings goal</label>
                <input
                  id="cfg-eoy-goal"
                  className="input-mono"
                  type="number"
                  min={0}
                  value={form.budgetPlan.eoySavingsGoal}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      budgetPlan: {
                        ...current.budgetPlan,
                        eoySavingsGoal: Number(event.target.value) || 0,
                      },
                    }))
                  }
                />
              </div>

              <div>
                <label htmlFor="cfg-goal-year">Goal year</label>
                <input
                  id="cfg-goal-year"
                  className="input-mono"
                  type="number"
                  min={new Date().getFullYear()}
                  value={form.budgetPlan.goalYear}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      budgetPlan: {
                        ...current.budgetPlan,
                        goalYear: Number(event.target.value) || new Date().getFullYear(),
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="bevel-out panel panel-tight">
              <div className="kicker">Preview</div>
              <div className="stack-16 top-gap-24">
                <div className="row">
                  <div className="muted">Weekly savings target</div>
                  <div className="mono">{formatMoney(preview.weeklySavingsTarget)}</div>
                </div>
                <div className="row">
                  <div className="muted">Monthly savings target</div>
                  <div className="mono">{formatMoney(preview.monthlySavingsTarget)}</div>
                </div>
                <div className="row">
                  <div className="muted">Weekly discretionary budget</div>
                  <div className="mono">{formatMoney(preview.weeklyDiscretionaryBudget)}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="cfg-trusted">Trusted person (optional)</label>
            <input
              id="cfg-trusted"
              type="text"
              value={form.trusted}
              placeholder="e.g. Sarah"
              onChange={(event) => updateField('trusted', event.target.value)}
            />
            <p className="sub sub-tight">If you add one, they can get a monthly snapshot text.</p>
          </div>

          <div className="bevel-in panel panel-tight">
            <div className="row row-top">
              <div>
                <div className="kicker">Extra reminders (optional)</div>
                <p className="sub">Add backup reminders if you want them.</p>
              </div>

              <div className="stack-16 form-checks">
                <label className="check-row" htmlFor="cfg-midweek">
                  <input
                    id="cfg-midweek"
                    type="checkbox"
                    checked={form.midweek}
                    onChange={(event) => updateField('midweek', event.target.checked)}
                  />
                  <span>Midweek reminder</span>
                </label>

                <label className="check-row" htmlFor="cfg-prep">
                  <input
                    id="cfg-prep"
                    type="checkbox"
                    checked={form.prep}
                    onChange={(event) => updateField('prep', event.target.checked)}
                  />
                  <span>Sunday prep reminder</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bevel-in panel panel-tight sync-inline-card">
            <div className="row row-top">
              <div>
                <div className="kicker">Sync</div>
                <p className="sub">Protect your progress across devices.</p>
              </div>
              <div className="tag">{syncStatusLabel}</div>
            </div>

            {!syncAvailable && (
              <p className="sub sub-top-16">Sync is unavailable because API settings are missing.</p>
            )}

            {syncAvailable && !syncEnabled && (
              <button className="btn btn-primary top-gap-24" onClick={onEnableSync} type="button">
                Enable Sync
              </button>
            )}

            {syncAvailable && syncEnabled && (
              <div className="stack-16 top-gap-24">
                <button className="btn" onClick={onCopySyncLink} type="button">
                  Copy Sync Link
                </button>
                {syncLink && <p className="sub">Keep this private link saved somewhere safe.</p>}
              </div>
            )}

            {syncMessage && <p className="sub sub-top-16">{syncMessage}</p>}
          </div>
        </div>

        <button className="btn btn-primary" type="submit">
          Save setup →
        </button>
      </form>
    </section>
  )
}
