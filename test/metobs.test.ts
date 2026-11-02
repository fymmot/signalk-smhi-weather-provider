import { describe, expect, it } from 'vitest'
import type { HttpClient } from '../src/http'
import { createMetobsClient } from '../src/provider/smhiMetobs'

const T = Date.parse('2026-11-02T10:00:00Z')

// Responses keyed by MetObs parameter id, shaped like the live API.
function fakeHttp(series: Record<number, string>): HttpClient & { urls: string[] } {
  const urls: string[] = []
  return {
    urls,
    async getJson<T>(url: string): Promise<T> {
      urls.push(url)
      const id = Number(/parameter\/(\d+)\//.exec(url)?.[1])
      if (url.includes('station-set/all')) {
        return {
          station: [
            {
              key: '98230',
              name: 'Stockholm-Observatoriekullen A',
              latitude: 59.3417,
              longitude: 18.0549,
              value: [{ date: T, value: '6.4' }]
            }
          ]
        } as T
      }
      const v = series[id]
      return { value: v === undefined ? [] : [{ date: T, value: v }] } as T
    }
  }
}

describe('MetObs observations', () => {
  it('reads wind from parameters 3 and 4 and converts to Signal K SI and ratios', async () => {
    // 1 °C, 3 degrees, 4 m/s, 6 percent. Parameter 2 is daily mean temperature and must not be read.
    const http = fakeHttp({ 1: '6.4', 2: '5.0', 3: '20', 4: '7.3', 6: '81' })
    const client = createMetobsClient({
      http,
      metobsBaseUrl: 'https://example.test/api',
      ttlSeconds: 0,
      keyDecimals: 2
    })
    const [obs] = await client.getObservations({ latitude: 59.33, longitude: 18.06 })

    expect(obs.outside?.temperature).toBeCloseTo(279.55)
    expect(obs.outside?.relativeHumidity).toBeCloseTo(0.81, 6)
    // A 20° direction used to be read as a 20 m/s speed.
    expect(obs.wind?.speedTrue).toBe(7.3)
    expect(obs.wind?.directionTrue).toBeCloseTo((20 * Math.PI) / 180)
    expect(http.urls.some((u) => u.includes('/parameter/2/'))).toBe(false)
  })
})
