import { useEffect, useRef } from 'react'

interface WalkthroughOverlayProps {
  show: boolean
  step: number
  title: string
  description: string
  buttonLabel: string
  onNext: () => void
  onSkip: () => void
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

export function WalkthroughOverlay({
  show,
  step,
  title,
  description,
  buttonLabel,
  onNext,
  onSkip,
}: WalkthroughOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show || !dialogRef.current) {
      return
    }

    const dialog = dialogRef.current
    const focusable = getFocusable(dialog)
    focusable[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onSkip()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const nodes = getFocusable(dialog)
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
  }, [show, onSkip])

  return (
    <div className={`overlay ${show ? 'show' : ''}`} aria-hidden={!show}>
      <div
        className="dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wt-title"
        aria-describedby="wt-desc"
      >
        <div className="dialog-top">
          <div className="kicker" id="wt-step">{`Step ${step} of 3`}</div>
          <button className="link" onClick={onSkip} type="button">
            Skip
          </button>
        </div>

        <h3 className="h1 h1-sm" id="wt-title">
          {title}
        </h3>
        <p className="sub" id="wt-desc">
          {description}
        </p>

        <div className="row row-end top-gap-24">
          <button className="btn btn-primary" onClick={onNext} type="button">
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
