import { describe, expect, it } from 'vitest'
import { decryptState, encryptState, parseSyncHash } from './sync'
import type { QuestboardState } from './state'

const sampleState: QuestboardState = {
  schemaVersion: 2,
  config: {
    name: 'Elias',
    day: 'Sunday',
    time: '19:00',
    targets: { debt: 800, tracks: 8 },
    trusted: '',
    midweek: true,
    prep: false,
  },
  appState: {
    targets: { debt: 800, tracks: 8 },
    current: { debt: 200, savings: 150, tracks: 2 },
    streakWeeks: 4,
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
