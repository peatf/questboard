import type { PropsWithChildren } from 'react'

interface WindowShellProps extends PropsWithChildren {
  clock: string
}

export function WindowShell({ clock, children }: WindowShellProps) {
  return (
    <div className="window pixel-border" id="app">
      <div className="titlebar">
        <div className="title-left">
          <div className="win-dots" aria-hidden>
            <button className="dot" type="button" tabIndex={-1} aria-label="Close window" />
            <button className="dot" type="button" tabIndex={-1} aria-label="Minimize window" />
            <button className="dot" type="button" tabIndex={-1} aria-label="Zoom window" />
          </div>
        </div>

        <div className="title">
          Questboard <span className="title-star">✦</span> Mission Window
        </div>

        <div className="title-right">
          <span className="mono" aria-live="polite">
            {clock}
          </span>
        </div>
      </div>

      <div className="menubar" aria-label="Menu bar">
        <span className="menuitem">File</span>
        <span className="menuitem">Edit</span>
        <span className="menuitem">View</span>
        <span className="menuitem">Help</span>
      </div>

      <div className="content">{children}</div>
    </div>
  )
}
