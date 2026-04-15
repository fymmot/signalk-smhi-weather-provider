import { describe, expect, it } from 'vitest'
import { createWarningsClient } from '../src/provider/smhiWarnings'

describe('warnings mapping', () => {
  it('filters warnings by polygon containing point', async () => {
    const http = {
      getJson: async () =>
        [
          {
            event: { en: 'Wind', code: 'WIND' },
            warningAreas: [
              {
                approximateStart: '2026-01-01T00:00:00.000Z',
                approximateEnd: '2026-01-02T00:00:00.000Z',
                warningLevel: { en: 'Yellow', code: 'YELLOW' },
                descriptions: [
                  { title: { code: 'INCIDENT' }, text: { en: 'Strong winds.' } }
                ],
                area: {
                  geometry: {
                    type: 'Polygon',
                    coordinates: [
                      [
                        [0, 0],
                        [10, 0],
                        [10, 10],
                        [0, 10],
                        [0, 0]
                      ]
                    ]
                  }
                }
              }
            ]
          }
        ] as any
    }

    const client = createWarningsClient({
      http,
      warningsBaseUrl: 'https://example.invalid',
      warningsFeedPath: '/feed.json',
      ttlSeconds: 60,
      keyDecimals: 3
    })

    const inside = await client.getWarnings({ latitude: 5, longitude: 5 })
    const outside = await client.getWarnings({ latitude: 50, longitude: 50 })
    expect(inside).toHaveLength(1)
    expect(inside[0].details).toContain('Strong winds')
    expect(outside).toHaveLength(0)
  })
})

