import { describe, expect, it } from 'vitest'
import { pointInPolygon } from '../src/geo'

describe('pointInPolygon', () => {
  it('detects point inside simple polygon', () => {
    const poly = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 10 },
      { latitude: 10, longitude: 10 },
      { latitude: 10, longitude: 0 },
      { latitude: 0, longitude: 0 }
    ]
    expect(pointInPolygon({ latitude: 5, longitude: 5 }, poly)).toBe(true)
    expect(pointInPolygon({ latitude: 15, longitude: 5 }, poly)).toBe(false)
  })
})

