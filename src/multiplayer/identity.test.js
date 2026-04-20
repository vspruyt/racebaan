import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildRoomShareUrl, getSharedRoomIdFromUrl } from './identity.js'
import { UUID_PATTERN, createRandomRoomId, createUuid } from '../../shared/multiplayer.js'

const originalCrypto = globalThis.crypto

function setCrypto(value) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value,
    writable: true,
  })
}

afterEach(() => {
  setCrypto(originalCrypto)
  vi.restoreAllMocks()
})

describe('createUuid', () => {
  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => '123e4567-e89b-42d3-a456-426614174000')
    setCrypto({ randomUUID })

    expect(createUuid()).toBe('123e4567-e89b-42d3-a456-426614174000')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    setCrypto({
      getRandomValues(array) {
        array.set([
          0x12,
          0x3e,
          0x45,
          0x67,
          0xe8,
          0x9b,
          0x02,
          0xd3,
          0x24,
          0x56,
          0x42,
          0x66,
          0x14,
          0x17,
          0x40,
          0x00,
        ])
        return array
      },
    })

    expect(createUuid()).toMatch(UUID_PATTERN)
    expect(createUuid()).toBe('123e4567-e89b-42d3-a456-426614174000')
  })

  it('falls back to Math.random when crypto is unavailable', () => {
    const values = [0.07, 0.23, 0.31, 0.4, 0.51, 0.6, 0.72, 0.83]
    let index = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = values[index % values.length]
      index += 1
      return value
    })
    setCrypto(undefined)

    expect(createUuid()).toMatch(UUID_PATTERN)
  })
})

describe('createRandomRoomId', () => {
  it('creates a room id from a UUID prefix', () => {
    setCrypto({
      randomUUID: () => '123e4567-e89b-42d3-a456-426614174000',
    })

    expect(createRandomRoomId()).toBe('room-123e4567')
  })
})

describe('getSharedRoomIdFromUrl', () => {
  it('reads a sanitized room id from the room query parameter', () => {
    expect(
      getSharedRoomIdFromUrl({
        href: 'https://racebaan.test/?room=Room_Test',
      }),
    ).toBe('room-test')
  })

  it('returns null for an invalid shared room id', () => {
    expect(
      getSharedRoomIdFromUrl({
        href: 'https://racebaan.test/?room=!!!',
      }),
    ).toBeNull()
  })
})

describe('buildRoomShareUrl', () => {
  it('adds the sanitized room id to the current url', () => {
    expect(
      buildRoomShareUrl('Room Test', {
        href: 'https://racebaan.test/play?foo=bar#grid',
      }),
    ).toBe('https://racebaan.test/play?foo=bar&room=room-test#grid')
  })

  it('returns null for an invalid room id', () => {
    expect(
      buildRoomShareUrl('!!!', {
        href: 'https://racebaan.test/',
      }),
    ).toBeNull()
  })
})
