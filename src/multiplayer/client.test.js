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
})
