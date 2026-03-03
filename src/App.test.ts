import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { WALKTHROUGH_PROGRESS_KEY, loadWalkthroughProgress } from './state'

declare global {
  // React uses this flag to enable act() assertions in non-Jest environments.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

interface MountedApp {
  container: HTMLDivElement
  root: Root
}

function mountApp(): MountedApp {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const root = createRoot(container)
  act(() => {
    root.render(createElement(App))
  })

  return { container, root }
}

function unmountApp({ container, root }: MountedApp): void {
  act(() => {
    root.unmount()
  })
  container.remove()
}

function findButton(container: HTMLElement, matcher: RegExp): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((node) =>
    matcher.test((node.textContent ?? '').replace(/\s+/g, ' ').trim()),
  )

  if (!button) {
    throw new Error(`Unable to find button matching ${String(matcher)}`)
  }

  return button
}

function clickButton(container: HTMLElement, matcher: RegExp): void {
  const button = findButton(container, matcher)
  act(() => {
    button.click()
  })
}

function openDashboard(container: HTMLElement): void {
  clickButton(container, /^Save setup/)
  clickButton(container, /^Open dashboard/)
}

function isWalkthroughVisible(container: HTMLElement): boolean {
  return container.querySelector('.overlay.show') !== null
}

describe('App walkthrough', () => {
  let mounted: MountedApp | null = null

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.clear()
    window.location.hash = ''
  })

  afterEach(() => {
    if (mounted) {
      unmountApp(mounted)
      mounted = null
    }
    window.localStorage.clear()
  })

  it('increments dismiss count when auto-opened walkthrough is skipped', () => {
    mounted = mountApp()
    openDashboard(mounted.container)

    expect(isWalkthroughVisible(mounted.container)).toBe(true)

    clickButton(mounted.container, /^Skip$/)

    expect(loadWalkthroughProgress()['finance-v1'].dismissCount).toBe(1)
  })

  it('does not increment dismiss count when manually opened walkthrough is skipped', () => {
    window.localStorage.setItem(
      WALKTHROUGH_PROGRESS_KEY,
      JSON.stringify({
        'finance-v1': {
          dismissCount: 2,
          completedAt: null,
          lastShownAt: null,
        },
      }),
    )

    mounted = mountApp()
    openDashboard(mounted.container)

    expect(isWalkthroughVisible(mounted.container)).toBe(false)

    clickButton(mounted.container, /WHAT'S NEW/)
    expect(isWalkthroughVisible(mounted.container)).toBe(true)

    clickButton(mounted.container, /^Skip$/)

    expect(loadWalkthroughProgress()['finance-v1'].dismissCount).toBe(2)
  })

  it('highlights finance card on purchase-decision walkthrough step', () => {
    mounted = mountApp()
    openDashboard(mounted.container)

    clickButton(mounted.container, /^Next/)
    clickButton(mounted.container, /^Next/)
    clickButton(mounted.container, /^Next/)

    const stepLabel = mounted.container.querySelector('#wt-step')?.textContent ?? ''
    const financeCard = mounted.container.querySelector('#card-finance')
    const calendarRule = mounted.container.querySelector('#calendar-rule')

    expect(stepLabel).toContain('Step 4 of 5')
    expect(financeCard?.classList.contains('walkthrough-highlight')).toBe(true)
    expect(calendarRule?.classList.contains('walkthrough-highlight-inline')).toBe(false)
  })
})
