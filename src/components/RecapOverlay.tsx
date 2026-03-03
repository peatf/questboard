import { useEffect, useRef } from 'react'
import { formatMoney } from '../state'

interface ProgressSnapshot {
  debt: number
  tracks: number
  savings: number
  requiredSpend: number
  discretionarySpend: number
}

export interface RecapData {
  before: ProgressSnapshot
  after: ProgressSnapshot
  streakWeeks: number
  score: number
  suggestionTag: 'TRACKS' | 'DEBT' | 'EVEN' | 'FINANCE'
  suggestionText: string
  financeVerdict: 'ON PACE' | 'CATCH-UP NEEDED'
  financeXpEarned: number
}

interface RecapOverlayProps {
  recap: RecapData | null
  onClose: () => void
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ]
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(','))).filter(
    (node) => !node.hasAttribute('aria-hidden'),
  )
}

export function RecapOverlay({ recap, onClose }: RecapOverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const show = recap !== null

  useEffect(() => {
    if (!show || !cardRef.current) {
      return
    }

    const card = cardRef.current
    const focusable = getFocusable(card)
    focusable[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const nodes = getFocusable(card)
      if (nodes.length === 0) {
        return
      }

      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [show, onClose])

  if (!recap) {
    return null
  }

  return (
    <div className={`recap ${show ? 'show' : ''}`} aria-hidden={!show}>
      <div
        className="recap-card stack-24"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recap-title"
        aria-describedby="recap-sub"
      >
        <div>
          <div className="kicker">Results</div>
          <h2 className="h1" id="recap-title">
            Check-in complete
          </h2>
          <p className="sub" id="recap-sub">{`Streak: ${recap.streakWeeks} weeks · Score: ${recap.score}`}</p>
        </div>

        <div className="bevel-out panel stack-16">
          <div className="row">
            <div className="muted">Debt</div>
            <div className="mono">{`${formatMoney(recap.before.debt)} → ${formatMoney(recap.after.debt)}`}</div>
          </div>
          <div className="row">
            <div className="muted">Tracks</div>
            <div className="mono">{`${recap.before.tracks} → ${recap.after.tracks}`}</div>
          </div>
          <div className="row">
            <div className="muted">Savings</div>
            <div className="mono">{`${formatMoney(recap.before.savings)} → ${formatMoney(
              recap.after.savings,
            )}`}</div>
          </div>
          <div className="row">
            <div className="muted">Required spend</div>
            <div className="mono">{`${formatMoney(recap.before.requiredSpend)} → ${formatMoney(
              recap.after.requiredSpend,
            )}`}</div>
          </div>
          <div className="row">
            <div className="muted">Fun spend</div>
            <div className="mono">{`${formatMoney(recap.before.discretionarySpend)} → ${formatMoney(
              recap.after.discretionarySpend,
            )}`}</div>
          </div>
        </div>

        <div className="bevel-in panel panel-tight stack-16">
          <div className="row">
            <div className="mono next-action">SYSTEM NOTE</div>
            <div className="tag">{recap.suggestionTag}</div>
          </div>
          <p className="sub">{recap.suggestionText}</p>
          <div className="row">
            <div className="muted">Finance verdict</div>
            <div className={`tag ${recap.financeVerdict === 'ON PACE' ? 'good' : 'warn'}`}>
              {recap.financeVerdict}
            </div>
          </div>
          <div className="row">
            <div className="muted">Finance XP earned</div>
            <div className="mono">{recap.financeXpEarned}</div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onClose} type="button">
          Done →
        </button>
      </div>
    </div>
  )
}
