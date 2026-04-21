import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_TRACK_ID } from '../../shared/multiplayer.js'
import { createMultiplayerClient } from './client.js'

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = MockWebSocket.CONNECTING
    this.listeners = new Map()
    this.sent = []
    MockWebSocket.instances.push(this)
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  send(payload) {
    this.sent.push(payload)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
  }

  emit(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

MockWebSocket.instances = []

const originalWindow = globalThis.window
const originalWebSocket = globalThis.WebSocket
const originalLocation = globalThis.location

function createIdentityProvider() {
  return () => ({
    anonymousPlayerId: '123e4567-e89b-42d3-a456-426614174000',
    displayName: 'Vincent',
    roomId: 'room-test',
  })
}

afterEach(() => {
  MockWebSocket.instances = []
  globalThis.window = originalWindow
  globalThis.WebSocket = originalWebSocket
  globalThis.location = originalLocation
  vi.restoreAllMocks()
})

describe('createMultiplayerClient', () => {
  it('ignores stale close events from a previous socket during reconnect', () => {
    globalThis.window = {
      clearInterval: vi.fn(),
      setInterval: vi.fn(() => 1),
    }
    globalThis.WebSocket = MockWebSocket
    globalThis.location = {
      protocol: 'https:',
      host: 'racebaan.test',
    }

    const client = createMultiplayerClient({
      identityProvider: createIdentityProvider(),
    })

    client.connect({ roomId: 'room-one', trackId: DEFAULT_TRACK_ID })
    const firstSocket = MockWebSocket.instances[0]
    firstSocket.readyState = MockWebSocket.OPEN
    firstSocket.emit('open')

    client.connect({ roomId: 'room-two', trackId: DEFAULT_TRACK_ID })
    const secondSocket = MockWebSocket.instances[1]

    firstSocket.emit('close')

    expect(client.getState().connectionStatus).toBe('connecting')
    expect(client.getState().roomId).toBe('room-two')

    secondSocket.readyState = MockWebSocket.OPEN
    secondSocket.emit('open')
    secondSocket.emit('message', {
      data: JSON.stringify({
        type: 'joined',
        roomId: 'room-two',
        roomStatus: 'lobby',
        trackId: DEFAULT_TRACK_ID,
      }),
    })

    expect(client.getState().connectionStatus).toBe('connected')
    expect(client.getState().roomStatus).toBe('connected')
    expect(client.getState().roomId).toBe('room-two')
  })

  it('keeps a connection error visible after the socket closes', () => {
    globalThis.window = {
      clearInterval: vi.fn(),
      setInterval: vi.fn(() => 1),
    }
    globalThis.WebSocket = MockWebSocket
    globalThis.location = {
      protocol: 'https:',
      host: 'racebaan.test',
    }

    const client = createMultiplayerClient({
      identityProvider: createIdentityProvider(),
    })

    client.connect({ roomId: 'room-test', trackId: DEFAULT_TRACK_ID })
    const socket = MockWebSocket.instances[0]

    socket.emit('error')
    socket.emit('close')

    expect(client.getState().connectionStatus).toBe('error')
    expect(client.getState().roomId).toBe('room-test')
    expect(client.getState().lastError).toBe('Could not connect to the room.')
  })

  it('tracks a local lap submission until the server acknowledges it', () => {
    globalThis.window = {
      clearInterval: vi.fn(),
      setInterval: vi.fn(() => 1),
    }
    globalThis.WebSocket = MockWebSocket
    globalThis.location = {
      protocol: 'https:',
      host: 'racebaan.test',
    }

    const client = createMultiplayerClient({
      identityProvider: createIdentityProvider(),
    })

    client.connect({ roomId: 'room-test', trackId: DEFAULT_TRACK_ID })
    const socket = MockWebSocket.instances[0]
    socket.readyState = MockWebSocket.OPEN
    socket.emit('open')
    socket.emit('message', {
      data: JSON.stringify({
        type: 'joined',
        roomId: 'room-test',
        roomStatus: 'lobby',
        trackId: DEFAULT_TRACK_ID,
      }),
    })
    socket.emit('message', {
      data: JSON.stringify({
        type: 'race_started',
        startedAt: Date.now(),
      }),
    })

    client.reportLapCompleted({
      lapNumber: 1,
      lapMs: 22333,
    })

    expect(client.getState().pendingLapSubmission).toMatchObject({
      lapNumber: 1,
      lapMs: 22333,
    })
    expect(client.getState().lastLapSubmission).toBeNull()

    socket.emit('message', {
      data: JSON.stringify({
        type: 'lap_completed',
        anonymousPlayerId: '123e4567-e89b-42d3-a456-426614174000',
        lapNumber: 1,
        lapMs: 22476,
      }),
    })

    expect(client.getState().pendingLapSubmission).toBeNull()
    expect(client.getState().lastLapSubmission).toMatchObject({
      status: 'accepted',
      lapNumber: 1,
      lapMs: 22333,
      officialLapMs: 22476,
    })
    expect(client.getState().lastError).toBeNull()
  })

  it('shows lap submission errors when the server rejects a lap', () => {
    globalThis.window = {
      clearInterval: vi.fn(),
      setInterval: vi.fn(() => 1),
    }
    globalThis.WebSocket = MockWebSocket
    globalThis.location = {
      protocol: 'https:',
      host: 'racebaan.test',
    }

    const client = createMultiplayerClient({
      identityProvider: createIdentityProvider(),
    })

    client.connect({ roomId: 'room-test', trackId: DEFAULT_TRACK_ID })
    const socket = MockWebSocket.instances[0]
    socket.readyState = MockWebSocket.OPEN
    socket.emit('open')
    socket.emit('message', {
      data: JSON.stringify({
        type: 'joined',
        roomId: 'room-test',
        roomStatus: 'lobby',
        trackId: DEFAULT_TRACK_ID,
      }),
    })
    socket.emit('message', {
      data: JSON.stringify({
        type: 'race_started',
        startedAt: Date.now(),
      }),
    })

    client.reportLapCompleted({
      lapNumber: 1,
      lapMs: 22333,
    })

    socket.emit('message', {
      data: JSON.stringify({
        type: 'error',
        code: 'invalid_lap_time',
        message: 'Lap timing did not pass basic validation.',
      }),
    })

    expect(client.getState().pendingLapSubmission).toBeNull()
    expect(client.getState().lastLapSubmission).toMatchObject({
      status: 'rejected',
      lapNumber: 1,
      lapMs: 22333,
      message: 'Lap timing did not pass basic validation.',
    })
    expect(client.getState().lastError).toBe('Lap timing did not pass basic validation.')
  })

  it('reports the player as ready after the local countdown ends', () => {
    globalThis.window = {
      clearInterval: vi.fn(),
      setInterval: vi.fn(() => 1),
    }
    globalThis.WebSocket = MockWebSocket
    globalThis.location = {
      protocol: 'https:',
      host: 'racebaan.test',
    }

    const client = createMultiplayerClient({
      identityProvider: createIdentityProvider(),
    })

    client.connect({ roomId: 'room-test', trackId: DEFAULT_TRACK_ID })
    const socket = MockWebSocket.instances[0]
    socket.readyState = MockWebSocket.OPEN
    socket.emit('open')
    socket.emit('message', {
      data: JSON.stringify({
        type: 'joined',
        roomId: 'room-test',
        roomStatus: 'racing',
        trackId: DEFAULT_TRACK_ID,
      }),
    })

    client.reportPlayerReady()

    expect(socket.sent).toContain(JSON.stringify({ type: 'player_ready' }))
  })

  it('keeps the room connected after another player finishes a run', () => {
    globalThis.window = {
      clearInterval: vi.fn(),
      setInterval: vi.fn(() => 1),
    }
    globalThis.WebSocket = MockWebSocket
    globalThis.location = {
      protocol: 'https:',
      host: 'racebaan.test',
    }

    const client = createMultiplayerClient({
      identityProvider: createIdentityProvider(),
    })

    client.connect({ roomId: 'room-test', trackId: DEFAULT_TRACK_ID })
    const socket = MockWebSocket.instances[0]
    socket.readyState = MockWebSocket.OPEN
    socket.emit('open')
    socket.emit('message', {
      data: JSON.stringify({
        type: 'joined',
        roomId: 'room-test',
        roomStatus: 'connected',
        trackId: DEFAULT_TRACK_ID,
      }),
    })
    socket.emit('message', {
      data: JSON.stringify({
        type: 'player_list',
        roomId: 'room-test',
        roomStatus: 'connected',
        players: [
          {
            anonymousPlayerId: '123e4567-e89b-42d3-a456-426614174000',
            displayName: 'Vincent',
            allTimeBestLapMs: null,
            bestLapMs: null,
            finishPlace: null,
            finished: false,
          },
          {
            anonymousPlayerId: '223e4567-e89b-42d3-a456-426614174000',
            displayName: 'Teammate',
            allTimeBestLapMs: 21000,
            bestLapMs: 22000,
            finishPlace: null,
            finished: false,
          },
        ],
      }),
    })

    socket.emit('message', {
      data: JSON.stringify({
        type: 'race_finished',
        anonymousPlayerId: '223e4567-e89b-42d3-a456-426614174000',
        bestLapMs: 21950,
        place: null,
      }),
    })

    client.sendPlayerState({
      timestamp: Date.now(),
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      velocity: [0, 0, 0],
      lap: 1,
      progress: 0.2,
    })

    expect(client.getState().roomStatus).toBe('connected')
    expect(socket.sent.at(-1)).toContain('"type":"player_state"')
  })
})
