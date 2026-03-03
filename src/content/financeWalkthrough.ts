import type { WalkthroughTarget, WalkthroughVersion } from '../state'

export interface FinanceWalkthroughStep {
  title: string
  description: string
  button: string
  target: WalkthroughTarget | null
}

export const FINANCE_WALKTHROUGH_VERSION: WalkthroughVersion = 'finance-v1'

export const FINANCE_WALKTHROUGH_STEPS: FinanceWalkthroughStep[] = [
  {
    title: 'New money tools are live.',
    description:
      'You can now track spending, stay on savings pace, and check purchases before you buy.',
    button: 'Next →',
    target: null,
  },
  {
    title: 'Log once each week.',
    description: 'Enter debt, savings, needs spend, and fun spend. Do this once from your reminder.',
    button: 'Next →',
    target: 'log',
  },
  {
    title: 'Watch your savings pace.',
    description: 'The pace card shows if you are on track or behind. Alerts tell you when to catch up.',
    button: 'Next →',
    target: 'finance',
  },
  {
    title: 'Use "Can I buy this?"',
    description: "Type the item cost and timing. You'll get YES, CAUTION, or NO with a clear reason.",
    button: 'Next →',
    target: 'finance',
  },
  {
    title: 'Earn Finance XP.',
    description: 'You get bonus XP for logging on time, hitting savings targets, and staying in budget.',
    button: 'Start →',
    target: null,
  },
]
