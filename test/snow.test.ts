import { describe, expect, it } from 'vitest'
import { deriveDailyFromPointSeries, mapSnowTsToPoint } from '../src/provider/smhiSnow'

describe('SNOW mapping', () => {
  it('maps basic SNOW timeSeries entry to WeatherData point', () => {
    const w = mapSnowTsToPoint({
      time: '2026-04-15T12:00:00.000Z',
      data: {
        air_temperature: 7.5,
        wind_speed: 5.2,
        wind_from_direction: 180,
        wind_speed_of_gust: 10.1,
        air_pressure_at_mean_sea_level: 1013.2,
        relative_humidity: 75,
        total_precipitation_amount: 0.4,
        symbol_code: 3
      }
    })
    expect(w.type).toBe('point')
    expect(w.outside?.temperature).toBe(7.5)
    expect(w.wind?.speedTrue).toBe(5.2)
    expect(w.wind?.directionTrue).toBe(180)
    expect(w.outside?.pressure).toBeCloseTo(101320)
    expect(w.description).toContain('symbol_code')
  })

  it('derives daily aggregates from point series', () => {
    const points = [
      {
        date: '2026-04-15T01:00:00.000Z',
        type: 'point' as const,
        outside: { temperature: 2, precipitationVolume: 1 }
      },
      {
        date: '2026-04-15T12:00:00.000Z',
        type: 'point' as const,
        outside: { temperature: 8, precipitationVolume: 2 }
      },
      {
        date: '2026-04-16T12:00:00.000Z',
        type: 'point' as const,
        outside: { temperature: 5, precipitationVolume: 3 }
      }
    ]
    const daily = deriveDailyFromPointSeries(points as any)
    expect(daily).toHaveLength(2)
    expect(daily[0].outside?.minTemperature).toBe(2)
    expect(daily[0].outside?.maxTemperature).toBe(8)
    expect(daily[0].outside?.precipitationVolume).toBe(3)
  })
})

