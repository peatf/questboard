import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SYNC_CONFIG,
  WALKTHROUGH_DONE_KEY,
  WALKTHROUGH_PROGRESS_KEY,
  computeMonthSpendingFromLogs,
  computeSavingsTargets,
  evaluatePurchaseDecision,
  hydrateQuestboardState,
  isLogOnTime,
  isWeeklyLogOverdue,
  loadWalkthroughProgress,
  markWalkthroughCompleted,
  markWalkthroughShown,
  markWalkthroughSkipped,
  recalculateProgressFromLogs,
  shouldShowWalkthrough,
  type QuestConfig,
} from './state'

describe('hydrateQuestboardState', () => {
  it('migrates legacy v1-style payload to v3 with finance defaults', () => {
    const legacy = {
      config: {
        name: 'Alex',
        day: 'Friday',
        time: '08:30',
        targets: {
          debt: 1200,
          tracks: 12,
        },
        trusted: 'Sam',
        midweek: false,
        prep: true,
      },
      appState: {
        targets: { debt: 1200, tracks: 12 },
        current: { debt: 300, savings: 75, tracks: 4 },
        streakWeeks: 6,
      },
      reminderSaved: true,
    }

    const state = hydrateQuestboardState(legacy)

    expect(state.schemaVersion).toBe(3)
    expect(state.config.name).toBe('Alex')
    expect(state.config.budgetPlan.monthlyIncome).toBe(0)
    expect(state.config.budgetPlan.eoySavingsGoal).toBe(0)
    expect(state.appState.current.debt).toBe(300)
    expect(state.appState.spending).toEqual({ required: 0, discretionary: 0 })
    expect(state.appState.logs).toEqual([])
    expect(state.appState.financeXp).toBe(0)
    expect(state.reminderSaved).toBe(true)
    expect(state.sync).toEqual(DEFAULT_SYNC_CONFIG)
  })

  it('sanitizes invalid numeric values to non-negative defaults', () => {
    const raw = {
      config: {
        budgetPlan: {
          monthlyIncome: -100,
          monthlyFixedBills: 'oops',
          eoySavingsGoal: -45,
          goalYear: -1,
          goalStartAt: 'bad',
        },
        targets: {
          debt: -100,
          tracks: 'oops',
        },
      },
      appState: {
        targets: {
          debt: -50,
          tracks: -3,
        },
        current: {
          debt: -1,
          savings: Number.NaN,
          tracks: 2,
        },
        spending: {
          required: -20,
          discretionary: Number.NaN,
        },
        streakWeeks: -9,
        financeXp: -10,
      },
      sync: {
        enabled: true,
        vaultId: 'abc',
        syncKey: 'key',
        deviceId: 'dev',
        lastPulledRevision: -2,
        lastSyncedAt: 'bad',
      },
    }

    const state = hydrateQuestboardState(raw)

    expect(state.config.targets.debt).toBe(0)
    expect(state.config.targets.tracks).toBe(0)
    expect(state.config.budgetPlan.monthlyIncome).toBe(0)
    expect(state.config.budgetPlan.monthlyFixedBills).toBe(0)
    expect(state.config.budgetPlan.eoySavingsGoal).toBe(0)
    expect(state.appState.current.debt).toBe(0)
    expect(state.appState.current.savings).toBe(0)
    expect(state.appState.spending.required).toBe(0)
    expect(state.appState.spending.discretionary).toBe(0)
    expect(state.appState.streakWeeks).toBe(0)
    expect(state.appState.financeXp).toBe(0)
    expect(state.sync.lastPulledRevision).toBe(0)
    expect(state.sync.lastSyncedAt).toBeNull()
  })
})

describe('finance walkthrough progress', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('is eligible when no progress exists', () => {
    expect(shouldShowWalkthrough('finance-v1')).toBe(true)
  })

  it('remains eligible after one skip', () => {
    markWalkthroughSkipped('finance-v1')

    const progress = loadWalkthroughProgress()['finance-v1']
    expect(progress.dismissCount).toBe(1)
    expect(shouldShowWalkthrough('finance-v1')).toBe(true)
  })

  it('stops auto-showing after second skip', () => {
    markWalkthroughSkipped('finance-v1')
    markWalkthroughSkipped('finance-v1')

    const progress = loadWalkthroughProgress()['finance-v1']
    expect(progress.dismissCount).toBe(2)
    expect(shouldShowWalkthrough('finance-v1')).toBe(false)
  })

  it('stops auto-showing after completion regardless of dismiss count', () => {
    markWalkthroughSkipped('finance-v1')
    markWalkthroughCompleted('finance-v1')

    const progress = loadWalkthroughProgress()['finance-v1']
    expect(progress.completedAt).not.toBeNull()
    expect(shouldShowWalkthrough('finance-v1')).toBe(false)
  })

  it('handles malformed walkthrough storage safely', () => {
    window.localStorage.setItem(WALKTHROUGH_PROGRESS_KEY, '{bad json')

    const progress = loadWalkthroughProgress()['finance-v1']
    expect(progress.dismissCount).toBe(0)
    expect(progress.completedAt).toBeNull()
    expect(shouldShowWalkthrough('finance-v1')).toBe(true)
  })

  it('ignores legacy walkthrough done key for finance walkthrough eligibility', () => {
    window.localStorage.setItem(WALKTHROUGH_DONE_KEY, '1')

    expect(shouldShowWalkthrough('finance-v1')).toBe(true)
  })

  it('records last shown timestamp when walkthrough is shown', () => {
    markWalkthroughShown('finance-v1')

    const progress = loadWalkthroughProgress()['finance-v1']
    expect(progress.lastShownAt).not.toBeNull()
  })
})

describe('computeSavingsTargets', () => {
  it('computes weekly and monthly targets based on remaining goal and remaining time', () => {
    const result = computeSavingsTargets(
      {
        monthlyIncome: 5000,
        monthlyFixedBills: 2500,
        eoySavingsGoal: 12000,
        goalYear: 2026,
        goalStartAt: new Date('2026-01-01T00:00:00').getTime(),
      },
      3000,
      new Date('2026-07-01T12:00:00'),
    )

    expect(result.remainingGoal).toBe(9000)
    expect(result.weeksRemaining).toBeGreaterThan(0)
    expect(result.weeklySavingsTarget).toBeCloseTo(result.remainingGoal / result.weeksRemaining)
    expect(result.monthlySavingsTarget).toBeCloseTo(
      result.remainingGoal / result.monthsRemainingIncludingCurrent,
    )
  })

  it('returns zero targets when goal is already met', () => {
    const result = computeSavingsTargets(
      {
        monthlyIncome: 4000,
        monthlyFixedBills: 2000,
        eoySavingsGoal: 5000,
        goalYear: 2026,
        goalStartAt: new Date('2026-01-01T00:00:00').getTime(),
      },
      6000,
      new Date('2026-10-01T00:00:00'),
    )

    expect(result.remainingGoal).toBe(0)
    expect(result.weeklySavingsTarget).toBe(0)
    expect(result.monthlySavingsTarget).toBe(0)
    expect(result.projectedGap).toBe(0)
  })
})

describe('evaluatePurchaseDecision', () => {
  it('returns YES when pace and budget remain protected', () => {
    const decision = evaluatePurchaseDecision(
      { cost: 40, timing: 'now' },
      {
        discretionaryBudgetRemaining: 150,
        weeklySavingsTarget: 200,
        projectedYearEndSavings: 1200,
        eoySavingsGoal: 1000,
      },
    )

    expect(decision.verdict).toBe('YES')
  })

  it('returns CAUTION when purchase creates small shortfall', () => {
    const decision = evaluatePurchaseDecision(
      { cost: 60, timing: 'this-week' },
      {
        discretionaryBudgetRemaining: 80,
        weeklySavingsTarget: 200,
        projectedYearEndSavings: 990,
        eoySavingsGoal: 1000,
      },
    )

    expect(decision.verdict).toBe('CAUTION')
  })

  it('returns NO when purchase causes shortfall of at least one weekly target', () => {
    const decision = evaluatePurchaseDecision(
      { cost: 300, timing: 'this-month' },
      {
        discretionaryBudgetRemaining: 500,
        weeklySavingsTarget: 150,
        projectedYearEndSavings: 1000,
        eoySavingsGoal: 1000,
      },
    )

    expect(decision.verdict).toBe('NO')
  })
})

describe('computeMonthSpendingFromLogs', () => {
  it('sums only entries from the current calendar month', () => {
    const totals = computeMonthSpendingFromLogs(
      [
        {
          id: 'current-1',
          weekKey: '2026-W09',
          loggedAt: new Date('2026-03-03T10:00:00').getTime(),
          debtPaid: 0,
          tracksMade: 0,
          savingsAdded: 0,
          requiredSpend: 120,
          discretionarySpend: 45,
          note: '',
          financeXp: 0,
        },
        {
          id: 'current-2',
          weekKey: '2026-W10',
          loggedAt: new Date('2026-03-17T10:00:00').getTime(),
          debtPaid: 0,
          tracksMade: 0,
          savingsAdded: 0,
          requiredSpend: 220,
          discretionarySpend: 65,
          note: '',
          financeXp: 0,
        },
        {
          id: 'previous-month',
          weekKey: '2026-W05',
          loggedAt: new Date('2026-02-05T10:00:00').getTime(),
          debtPaid: 0,
          tracksMade: 0,
          savingsAdded: 0,
          requiredSpend: 999,
          discretionarySpend: 999,
          note: '',
          financeXp: 0,
        },
      ],
      new Date('2026-03-20T12:00:00'),
    )

    expect(totals).toEqual({ required: 340, discretionary: 110 })
  })
})

describe('recalculateProgressFromLogs', () => {
  it('recalculates cumulative totals, streak, and finance xp from logs', () => {
    const totals = recalculateProgressFromLogs([
      {
        id: 'a',
        weekKey: '2026-W01',
        loggedAt: new Date('2026-01-03T10:00:00').getTime(),
        debtPaid: 100,
        tracksMade: 1,
        savingsAdded: 200,
        requiredSpend: 300,
        discretionarySpend: 80,
        note: '',
        financeXp: 50,
      },
      {
        id: 'b',
        weekKey: '2026-W02',
        loggedAt: new Date('2026-01-10T10:00:00').getTime(),
        debtPaid: 40,
        tracksMade: 2,
        savingsAdded: 120,
        requiredSpend: 320,
        discretionarySpend: 60,
        note: '',
        financeXp: 60,
      },
    ])

    expect(totals.current).toEqual({ debt: 140, savings: 320, tracks: 3 })
    expect(totals.spending).toEqual({ required: 620, discretionary: 140 })
    expect(totals.streakWeeks).toBe(2)
    expect(totals.financeXp).toBe(110)
  })
})

describe('isWeeklyLogOverdue', () => {
  const baseConfig: QuestConfig = {
    name: 'Elias',
    day: 'Sunday',
    time: '19:00',
    targets: { debt: 800, tracks: 8 },
    trusted: '',
    midweek: true,
    prep: false,
    budgetPlan: {
      monthlyIncome: 4000,
      monthlyFixedBills: 2000,
      eoySavingsGoal: 10000,
      goalYear: 2026,
      goalStartAt: new Date('2026-01-01T00:00:00').getTime(),
    },
  }

  it('returns true when scheduled check-in has passed and no log exists for that cycle', () => {
    const now = new Date('2026-07-13T20:00:00')
    expect(isWeeklyLogOverdue(baseConfig, [], now)).toBe(true)
  })

  it('returns false when the cycle has already been logged', () => {
    const now = new Date('2026-07-13T20:00:00')
    const logWeekKey = '2026-W28'
    expect(
      isWeeklyLogOverdue(
        baseConfig,
        [
          {
            id: 'l1',
            weekKey: logWeekKey,
            loggedAt: new Date('2026-07-12T21:00:00').getTime(),
            debtPaid: 0,
            tracksMade: 0,
            savingsAdded: 100,
            requiredSpend: 300,
            discretionarySpend: 40,
            note: '',
            financeXp: 20,
          },
        ],
        now,
      ),
    ).toBe(false)
  })
})

describe('isLogOnTime', () => {
  const config: QuestConfig = {
    name: 'Elias',
    day: 'Sunday',
    time: '19:00',
    targets: { debt: 800, tracks: 8 },
    trusted: '',
    midweek: true,
    prep: false,
    budgetPlan: {
      monthlyIncome: 4000,
      monthlyFixedBills: 2000,
      eoySavingsGoal: 10000,
      goalYear: 2026,
      goalStartAt: new Date('2026-01-01T00:00:00').getTime(),
    },
  }

  it('returns true when logged before the week due timestamp', () => {
    expect(isLogOnTime(config, '2026-W28', new Date('2026-07-12T18:30:00').getTime())).toBe(true)
  })

  it('returns false when logged after the week due timestamp', () => {
    expect(isLogOnTime(config, '2026-W28', new Date('2026-07-12T20:30:00').getTime())).toBe(false)
  })
})
