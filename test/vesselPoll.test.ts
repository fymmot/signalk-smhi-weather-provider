import { describe, expect, it } from 'vitest'
import { parseNavigationPosition } from '../src/vesselPoll'

describe('parseNavigationPosition', () => {
  it('reads latitude/longitude from getSelfPath-style object', () => {
    expect(
      parseNavigationPosition({
        value: { latitude: 59.3, longitude: 18.1 }
      })
    ).toEqual({ latitude: 59.3, longitude: 18.1 })
  })

  it('returns null when value missing', () => {
    expect(parseNavigationPosition({})).toBeNull()
    expect(parseNavigationPosition(null)).toBeNull()
    expect(parseNavigationPosition({ value: {} })).toBeNull()
  })
})
