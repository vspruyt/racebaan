import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
}))

const { RaceRoom } = await import('./race-room.js')

function createStorageMock() {
  return {
    value: undefined,
    alarmAt: null,
    async get(key) {
      return key === 'room-state' ? this.value : undefined
    },
    async put(key, value) {
      if (key === 'room-state') {
        this.value = structuredClone(value)
      }
    },
    setAlarm(timestamp) {
      this.alarmAt = timestamp
    },
    async deleteAlarm() {
      this.alarmAt = null
    },
    async deleteAll() {
      this.value = undefined
      this.alarmAt = null
    },
  }
}

function createEnvMock() {
  return {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async run() {
                return {}
              },
              async all() {
                return { results: [] }
              },
            }
          },
        }
      },
    },
  }
}

function createCtxMock(storage) {
  return {
    storage,
    id: {
      toString() {
        return 'room-test'
      },
    },
    getWebSockets() {
      return []
    },
    acceptWebSocket() {},
  }
}

function createSocketMock() {
  return {
    sent: [],
    send(message) {
      this.sent.push(message)
    },
    close() {},
    serializeAttachment() {},
    deserializeAttachment() {
      return null
    },
  }
}

function createConnection(joined = true) {
  return {
    attachment: {
      connectionId: 'connection-1',
      ipAddress: '127.0.0.1',
      connectedAt: Date.now(),
      joined,
      anonymousPlayerId: '123e4567-e89b-42d3-a456-426614174000',
      displayName: 'Racer',
      trackId: 'default',
      raceStartedAt: null,
      currentLapNumber: 0,
      currentLapStartedAt: null,
      bestLapMs: null,
      raceMs: null,
      finished: false,
      finishPlace: null,
      acceptedLapSubmissions: [],
      lastJoinedAt: null,
      lastPingAt: null,
    },
    joinedPlayerState: null,
    previousProgress: null,
    lastProgress: null,
    messageWindowStartedAt: Date.now(),
    messageCount: 0,
  }
}

function createRoomState(overrides = {}) {
  return {
    roomId: 'room-test',
    trackId: 'default',
    status: 'lobby',
    countdownStartedAt: null,
    raceStartedAt: null,
    finishedAt: null,
    finishers: [],
    cleanupScheduledAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('RaceRoom cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('schedules room storage cleanup after the last socket disconnects', async () => {
    const storage = createStorageMock()
    const room = new RaceRoom(createCtxMock(storage), createEnvMock())
    const socket = createSocketMock()

    room.roomState = createRoomState()
    room.connections.set(socket, createConnection())

    await room.webSocketClose(socket, 1000, 'Client disconnected')
    await vi.runAllTimersAsync()

    expect(storage.value?.cleanupScheduledAt).toBe(Date.now() + 5 * 60 * 1000)
    expect(storage.alarmAt).toBe(Date.now() + 5 * 60 * 1000)
  })

  it('deletes room storage when the cleanup alarm fires for an idle room', async () => {
    const storage = createStorageMock()
    const room = new RaceRoom(createCtxMock(storage), createEnvMock())

    room.roomState = createRoomState({
      cleanupScheduledAt: Date.now(),
    })
    storage.value = structuredClone(room.roomState)

    await room.alarm()

    expect(storage.value).toBeUndefined()
    expect(storage.alarmAt).toBeNull()
    expect(room.roomState).toBeNull()
  })

  it('starts the room immediately and waits for player_ready before arming laps', async () => {
    const storage = createStorageMock()
    const room = new RaceRoom(createCtxMock(storage), createEnvMock())
    const socket = createSocketMock()
    const connection = createConnection(false)

    room.roomState = createRoomState()
    room.connections.set(socket, connection)

    await room.handleJoin(socket, {
      anonymousPlayerId: '123e4567-e89b-42d3-a456-426614174000',
      displayName: 'Racer',
      trackId: 'default',
    })

    expect(room.roomState.status).toBe('racing')
    expect(connection.attachment.currentLapNumber).toBe(0)
    expect(connection.attachment.currentLapStartedAt).toBeNull()

    await room.handlePlayerReady(socket)

    expect(connection.attachment.currentLapNumber).toBe(1)
    expect(connection.attachment.currentLapStartedAt).toBe(Date.now())
    expect(
      socket.sent.some((message) => JSON.parse(message).type === 'player_ready'),
    ).toBe(true)
  })
})
