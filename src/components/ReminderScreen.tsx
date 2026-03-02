import type { QuestConfig } from '../state'

interface ReminderScreenProps {
  config: QuestConfig
  reminderSaved: boolean
  onSaveReminder: () => void
  onEnterDashboard: () => void
  onBack: () => void
}

export function ReminderScreen({
  config,
  reminderSaved,
  onSaveReminder,
  onEnterDashboard,
  onBack,
}: ReminderScreenProps) {
  return (
    <section id="screen-reminder" className="stack-24">
      <div>
        <div className="kicker">Calendar</div>
        <h1 className="h1">Add the reminder</h1>
        <p className="sub">
          Save once, then use the reminder event as your weekly trigger. On iPhone Chrome, use Share then
          Calendar.
        </p>
      </div>

      <div className="bevel-out panel stack-24">
        <div className="bevel-in panel panel-tight">
          <div className="row row-space-between">
            <div>
              <div className="kicker">Reminder Pack</div>
              <div className="sub sub-tight">Weekly check-in + monthly reset</div>
            </div>
            <div className="mono">{`${config.day} @ ${config.time}`}</div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onSaveReminder} type="button">
          Save reminder
        </button>

        <button
          className={`btn ${reminderSaved ? '' : 'btn-disabled'}`}
          onClick={onEnterDashboard}
          type="button"
          aria-disabled={!reminderSaved}
        >
          Open dashboard →
        </button>
      </div>

      <button className="btn" onClick={onBack} type="button">
        ← Back
      </button>
    </section>
  )
}
