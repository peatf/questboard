import { useEffect, useRef } from 'react'

interface SyncPanelProps {
  show: boolean
  syncEnabled: boolean
  syncStatusLabel: string
  syncMessage: string
  onClose: () => void
  onCopySyncLink: () => void
  onPullNow: () => void
  onPushNow: () => void
  onDisableThisDevice: () => void
}

interface SyncConflictOverlayProps {
  show: boolean
  onKeepLocal: () => void
  onUseCloud: () => void
  onDismiss: () => void
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

function useDialogFocusTrap(show: boolean, onEscape: () => void) {
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
        onEscape()
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
  }, [show, onEscape])

  return dialogRef
}

export function SyncPanel({
  show,
  syncEnabled,
  syncStatusLabel,
  syncMessage,
  onClose,
  onCopySyncLink,
  onPullNow,
  onPushNow,
  onDisableThisDevice,
}: SyncPanelProps) {
  const dialogRef = useDialogFocusTrap(show, onClose)

  return (
    <div className={`overlay ${show ? 'show' : ''}`} aria-hidden={!show}>
      <div
        className="dialog stack-24"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-title"
        aria-describedby="sync-desc"
      >
        <div className="row row-top">
          <div>
            <div className="kicker">Sync</div>
            <h3 className="h1 h1-sm" id="sync-title">
              Data sync controls
            </h3>
            <p className="sub" id="sync-desc">
              Keep one secure link saved so you can restore on any device.
            </p>
          </div>
          <div className="tag">{syncStatusLabel}</div>
        </div>

        {!syncEnabled && <p className="sub">Sync is not enabled on this device yet.</p>}

        {syncEnabled && (
          <div className="stack-16">
            <button className="btn" onClick={onCopySyncLink} type="button">
              Copy Sync Link
            </button>
            <div className="grid-2">
              <button className="btn" onClick={onPullNow} type="button">
                Pull Latest Now
              </button>
              <button className="btn" onClick={onPushNow} type="button">
                Push Now
              </button>
            </div>
            <button className="btn" onClick={onDisableThisDevice} type="button">
              Disable Sync On This Device
            </button>
          </div>
        )}

        {syncMessage && <p className="sub">{syncMessage}</p>}

        <div className="row row-end">
          <button className="btn btn-primary" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function SyncConflictOverlay({
  show,
  onKeepLocal,
  onUseCloud,
  onDismiss,
}: SyncConflictOverlayProps) {
  const dialogRef = useDialogFocusTrap(show, onDismiss)

  return (
    <div className={`overlay ${show ? 'show' : ''}`} aria-hidden={!show}>
      <div
        className="dialog stack-24"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-conflict-title"
        aria-describedby="sync-conflict-desc"
      >
        <div>
          <div className="kicker">Sync conflict</div>
          <h3 className="h1 h1-sm" id="sync-conflict-title">
            Choose which version to keep
          </h3>
          <p className="sub" id="sync-conflict-desc">
            Cloud changed while this device had unsynced edits.
          </p>
        </div>

        <div className="bevel-out panel stack-16">
          <button className="btn btn-primary" onClick={onKeepLocal} type="button">
            Keep Local And Overwrite Cloud
          </button>
          <button className="btn" onClick={onUseCloud} type="button">
            Use Cloud Version
          </button>
        </div>

        <button className="btn" onClick={onDismiss} type="button">
          Dismiss
        </button>
      </div>
    </div>
  )
}
