import { useEffect, useState, type FormEvent } from 'react'
import { clampNonNegative, type QuestConfig } from '../state'

interface SetupScreenProps {
  config: QuestConfig
  onContinue: (config: QuestConfig) => void
}

export function SetupScreen({ config, onContinue }: SetupScreenProps) {
  const [form, setForm] = useState<QuestConfig>(config)

  useEffect(() => {
    setForm(config)
  }, [config])

  const updateField = <K extends keyof QuestConfig>(key: K, value: QuestConfig[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

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
        </div>

        <button className="btn btn-primary" type="submit">
          Save setup →
        </button>
      </form>
    </section>
  )
}
