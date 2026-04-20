import { describe, expect, it } from 'vitest'

import {
  formatLapTime,
  getFastMotionRatio,
  getTrackZoneProgress,
  moveTowards,
  wrapTrackDistance,
} from './utils.js'

describe('formatLapTime', () => {
  it('formats milliseconds into mm:ss.mmm', () => {
    expect(formatLapTime(65.432)).toBe('01:05.432')
  })
})

describe('wrapTrackDistance', () => {
  it('wraps positive and negative distances', () => {
    expect(wrapTrackDistance(27, 20)).toBe(7)
    expect(wrapTrackDistance(-3, 20)).toBe(17)
  })
})

describe('getTrackZoneProgress', () => {
  it('returns progress when distance is in the zone', () => {
    expect(getTrackZoneProgress(15, 10, 10, 100)).toBe(0.5)
  })

  it('returns null when distance is outside the zone', () => {
    expect(getTrackZoneProgress(25, 10, 10, 100)).toBeNull()
  })

  it('supports wrapped zones', () => {
    expect(getTrackZoneProgress(4, 95, 12, 100)).toBeCloseTo(0.75)
  })
})

describe('moveTowards', () => {
  it('moves toward the target without overshooting', () => {
    expect(moveTowards(0, 10, 3)).toBe(3)
    expect(moveTowards(8, 10, 3)).toBe(10)
  })
})

describe('getFastMotionRatio', () => {
  it('stays bounded between zero and one', () => {
    expect(getFastMotionRatio(0)).toBe(0)
    expect(getFastMotionRatio(10_000)).toBe(1)
  })
})
