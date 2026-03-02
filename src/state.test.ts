import { describe, expect, it } from 'vitest'
import { DEFAULT_SYNC_CONFIG, hydrateQuestboardState } from './state'

describe('hydrateQuestboardState', () => {
  it('migrates legacy v1-style payload to v2 with sync defaults', () => {
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

    expect(state.schemaVersion).toBe(2)
    expect(state.config.name).toBe('Alex')
    expect(state.appState.current.debt).toBe(300)
    expect(state.reminderSaved).toBe(true)
    expect(state.sync).toEqual(DEFAULT_SYNC_CONFIG)
  })

  it('sanitizes invalid numeric values to non-negative defaults', () => {
    const raw = {
      config: {
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
          savings: NaN,
          tracks: 2,
        },
        streakWeeks: -9,
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
    expect(state.appState.current.debt).toBe(0)
    expect(state.appState.current.savings).toBe(0)
    expect(state.appState.streakWeeks).toBe(0)
    expect(state.sync.lastPulledRevision).toBe(0)
    expect(state.sync.lastSyncedAt).toBeNull()
  })
})
