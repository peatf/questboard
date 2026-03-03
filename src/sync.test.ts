import { describe, expect, it } from 'vitest'
import { decryptState, encryptState, parseSyncHash } from './sync'
import type { QuestboardState } from './state'

const sampleState: QuestboardState = {
  schemaVersion: 3,
  config: {
    name: 'Elias',
    day: 'Sunday',
    time: '19:00',
    targets: { debt: 800, tracks: 8 },
    trusted: '',
    midweek: true,
    prep: false,
    budgetPlan: {
      monthlyIncome: 4000,
      monthlyFixedBills: 2200,
      eoySavingsGoal: 10000,
      goalYear: 2026,
      goalStartAt: 1704067200000,
    },
  },
  appState: {
    targets: { debt: 800, tracks: 8 },
    current: { debt: 200, savings: 150, tracks: 2 },
    spending: { required: 300, discretionary: 120 },
    streakWeeks: 4,
    financeXp: 80,
    logs: [
      {
        id: 'log-1',
        weekKey: '2026-W01',
        loggedAt: 1704067200000,
        debtPaid: 50,
        tracksMade: 1,
        savingsAdded: 75,
        requiredSpend: 120,
        discretionarySpend: 45,
        note: 'Seed log',
        financeXp: 40,
      },
    ],
  },
  reminderSaved: false,
  sync: {
    enabled: true,
    vaultId: 'vault-123',
    syncKey: 'local-key',
    deviceId: 'device-a',
    lastSyncedAt: null,
    lastPulledRevision: null,
  },
}

describe('sync crypto', () => {
  it('encrypts and decrypts questboard state round-trip', async () => {
    const syncKey = 'f8gKsR8h6ZoFf1zPmvYdSRdJSDVeU_E1Tb8eYmtcIiY'
    const encrypted = await encryptState(sampleState, syncKey)
    const restored = await decryptState(encrypted, syncKey)

    expect(restored).toEqual(sampleState)
  })
})

describe('parseSyncHash', () => {
  it('parses valid sync hash payload', () => {
    expect(parseSyncHash('#sync=vault-id.secret-key')).toEqual({
      vaultId: 'vault-id',
      syncKey: 'secret-key',
    })
  })

  it('returns null for invalid payload', () => {
    expect(parseSyncHash('#sync=badpayload')).toBeNull()
    expect(parseSyncHash('#foo=bar')).toBeNull()
    expect(parseSyncHash('')).toBeNull()
  })
})
