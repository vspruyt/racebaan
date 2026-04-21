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
  const preparedStatements = []
  const batchedStatements = []

  return {
    preparedStatements,
    batchedStatements,
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            const statement = {
              sql,
              params,
              async run() {
                return {}
              },
              async all() {
                return { results: [] }
              },
              async first() {
                return null
              },
            }

            preparedStatements.push(statement)
            return statement
          },
        }
      },
      async batch(statements) {
        batchedStatements.push(...statements)
        return statements.map(() => ({}))
      },
    },
  }
}

function getSqlStatement(statements, snippet) {
  return (
    statements.find((statement) => statement.sql.includes(snippet)) ?? null
  )
}

function expectSqlParams(statements, snippet, params) {
  expect(getSqlStatement(statements, snippet)?.params).toEqual(params)
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
      lastSeenAt: Date.now(),
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
    status: 'connected',
    countdownStartedAt: null,
    raceStartedAt: null,
    finishedAt: null,
    finishers: [],
    cleanupScheduledAt: null,
    staleTimeoutAt: null,
    lastActivityAt: Date.now(),
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

  it('keeps the room open and waits for player_ready before arming laps', async () => {
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

    expect(room.roomState.status).toBe('connected')
    expect(connection.attachment.currentLapNumber).toBe(0)
    expect(connection.attachment.currentLapStartedAt).toBeNull()

    await room.handlePlayerReady(socket)

    expect(connection.attachment.currentLapNumber).toBe(1)
    expect(connection.attachment.currentLapStartedAt).toBe(Date.now())
    expect(
      socket.sent.some((message) => JSON.parse(message).type === 'player_ready'),
    ).toBe(true)
  })

  it('does not mark the room finished when one player completes a run', async () => {
    const storage = createStorageMock()
    const env = createEnvMock()
    const room = new RaceRoom(createCtxMock(storage), env)
    const socket = createSocketMock()
    const connection = createConnection()
    const raceStartedAt = Date.now() - 20_000

    connection.attachment.raceStartedAt = raceStartedAt
    connection.attachment.currentLapNumber = 4
    connection.attachment.currentLapStartedAt = Date.now() - 6_000
    connection.attachment.bestLapMs = 18_000

    room.roomState = createRoomState()
    room.connections.set(socket, connection)

    await room.handleRaceFinished(socket, {
      raceMs: 20_000,
    })

    expect(room.roomState.status).toBe('connected')
    expect(room.roomState.finishedAt).toBeNull()
    expect(connection.attachment.finished).toBe(true)
    expect(connection.attachment.finishPlace).toBeNull()
    expectSqlParams(env.batchedStatements, 'INSERT INTO race_results', [
      '123e4567-e89b-42d3-a456-426614174000',
      'Racer',
      'room-test',
      'default',
      1,
      20_000,
      18_000,
      Date.now(),
    ])
  })

  it('updates stored leaderboard names when a player rejoins under a new display name', async () => {
    const storage = createStorageMock()
    const env = createEnvMock()
    const room = new RaceRoom(createCtxMock(storage), env)
    const socket = createSocketMock()

    room.roomState = createRoomState()
    room.connections.set(socket, createConnection(false))

    await room.handleJoin(socket, {
      anonymousPlayerId: '123e4567-e89b-42d3-a456-426614174000',
      displayName: 'New Racer',
      trackId: 'default',
    })

    expect(env.batchedStatements).toHaveLength(2)
    expectSqlParams(env.preparedStatements, 'INSERT INTO active_rooms', [
      'room-test',
      1,
      Date.now(),
    ])
    expectSqlParams(env.batchedStatements, 'UPDATE lap_times', [
      'New Racer',
      '123e4567-e89b-42d3-a456-426614174000',
    ])
    expectSqlParams(env.batchedStatements, 'UPDATE race_results', [
      'New Racer',
      '123e4567-e89b-42d3-a456-426614174000',
    ])
  })

  it('removes the room from the active room list when the last player leaves', async () => {
    const storage = createStorageMock()
    const env = createEnvMock()
    const room = new RaceRoom(createCtxMock(storage), env)
    const socket = createSocketMock()

    room.roomState = createRoomState()
    room.connections.set(socket, createConnection())

    await room.webSocketClose(socket, 1000, 'Client disconnected')

    expectSqlParams(env.preparedStatements, 'DELETE FROM active_rooms', ['room-test'])
  })

  it('cleans up stale rooms even if websocket close was missed', async () => {
    const storage = createStorageMock()
    const env = createEnvMock()
    const room = new RaceRoom(createCtxMock(storage), env)
    const socket = createSocketMock()
    const staleSeenAt = Date.now() - 80_000

    room.roomState = createRoomState({
      staleTimeoutAt: Date.now(),
      lastActivityAt: staleSeenAt,
    })
    storage.value = structuredClone(room.roomState)

    const connection = createConnection()
    connection.attachment.lastSeenAt = staleSeenAt
    connection.attachment.lastPingAt = staleSeenAt
    room.connections.set(socket, connection)

    await room.alarm()

    expect(room.connections.size).toBe(0)
    expect(storage.value).toBeUndefined()
    expect(storage.alarmAt).toBeNull()
    expectSqlParams(env.preparedStatements, 'DELETE FROM active_rooms', ['room-test'])
  })
})
