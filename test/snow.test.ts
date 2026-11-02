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
    expect(w.outside?.temperature).toBeCloseTo(280.65)
    expect(w.wind?.speedTrue).toBe(5.2)
    expect(w.wind?.directionTrue).toBeCloseTo(Math.PI)
    expect(w.outside?.pressure).toBeCloseTo(101320)
    expect(w.description).toContain('symbol_code')
  })

  it('converts SNOW1g display units to Signal K SI and ratios', () => {
    // Units per SNOW1g parameter.json: °C, hPa, percent, oktas, km, mm, degrees.
    const w = mapSnowTsToPoint({
      time: '2026-11-05T00:00:00Z',
      data: {
        air_temperature: 0.6,
        air_pressure_at_mean_sea_level: 1012.0,
        relative_humidity: 93,
        cloud_area_fraction: 6,
        visibility_in_air: 5.8,
        precipitation_amount_mean: 0.5,
        wind_from_direction: 266,
        wind_speed: 4.0,
        wind_speed_of_gust: 12.0
      }
    })
    expect(w.outside?.temperature).toBeCloseTo(273.75)
    expect(w.outside?.pressure).toBeCloseTo(101200)
    expect(w.outside?.relativeHumidity).toBeCloseTo(0.93, 6)
    expect(w.outside?.cloudCover).toBeCloseTo(0.75, 6)
    expect(w.outside?.horizontalVisibility).toBeCloseTo(5800)
    expect(w.outside?.precipitationVolume).toBeCloseTo(0.0005, 7)
    expect(w.outside?.dewPointTemperature).toBeUndefined()
    expect(w.wind?.directionTrue).toBeCloseTo((266 * Math.PI) / 180)
    expect(w.wind?.speedTrue).toBe(4.0)
    expect(w.wind?.gust).toBe(12.0)
  })

  it('maps SNOW1g precipitation_amount_mean to the step interval amount', () => {
    // Captured from the live API (Tromsø, approved 2026-11-02): the last hourly step and the
    // first 3 h step. The 3 h value is ~3× the hourly ones, so it is an amount, not a rate.
    const hourly = mapSnowTsToPoint({
      time: '2026-11-05T00:00:00Z',
      intervalParametersStartTime: '2026-11-04T23:00:00Z',
      data: {
        air_temperature: 0.6,
        wind_from_direction: 266,
        wind_speed: 4.0,
        wind_speed_of_gust: 12.0,
        precipitation_amount_mean_deterministic: 0.1,
        precipitation_amount_mean: 0.5,
        precipitation_amount_min: 0.3,
        precipitation_amount_max: 0.6,
        precipitation_amount_median: 0.4,
        probability_of_precipitation: 100,
        symbol_code: 12
      }
    })
    const threeHourly = mapSnowTsToPoint({
      time: '2026-11-05T03:00:00Z',
      intervalParametersStartTime: '2026-11-05T00:00:00Z',
      data: {
        air_temperature: 0.6,
        precipitation_amount_mean_deterministic: 2.6,
        precipitation_amount_mean: 1.2,
        precipitation_amount_min: 0.9,
        precipitation_amount_max: 1.6,
        precipitation_amount_median: 1.1,
        probability_of_precipitation: 97,
        symbol_code: 22
      }
    })
    // Signal K precipitationVolume is metres.
    expect(hourly.outside?.precipitationVolume).toBeCloseTo(0.0005, 7)
    expect(threeHourly.outside?.precipitationVolume).toBeCloseTo(0.0012, 7)
    expect(deriveDailyFromPointSeries([hourly, threeHourly])[0].outside?.precipitationVolume)
      .toBeCloseTo(0.0017, 7)
  })

  it('falls back to total_precipitation_amount and skips the missing sentinel', () => {
    const legacy = mapSnowTsToPoint({
      time: '2026-04-15T12:00:00.000Z',
      data: { total_precipitation_amount: 0.4 }
    })
    expect(legacy.outside?.precipitationVolume).toBeCloseTo(0.0004, 7)

    const missing = mapSnowTsToPoint({
      time: '2026-04-15T12:00:00.000Z',
      data: { air_temperature: 3, precipitation_amount_mean: 9999 }
    })
    expect(missing.outside?.precipitationVolume).toBeUndefined()
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

