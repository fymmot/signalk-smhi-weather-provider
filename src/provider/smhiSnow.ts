import type { WeatherData } from '../types'
import { createAsyncCache } from '../cache'
import { roundCoord } from '../geo'
import type { HttpClient } from '../http'

type SnowTimeSeriesEntry = {
  time: string
  data: Record<string, number>
}

type SnowPointResponse = {
  approvedTime?: string
  referenceTime?: string
  geometry?: {
    type?: string
    coordinates?: [number, number]
  }
  timeSeries: SnowTimeSeriesEntry[]
}

function isMissing(value: number): boolean {
  // Community reports SNOW missing sentinel as 9999; keep tolerant.
  return value === 9999 || value === -9999
}

function num(data: Record<string, number>, key: string): number | undefined {
  const v = data[key]
  if (typeof v !== 'number') return undefined
  if (!Number.isFinite(v)) return undefined
  if (isMissing(v)) return undefined
  return v
}

function cToCelsius(v: number): number {
  return v
}

function hPaToPa(hpa: number): number {
  return hpa * 100
}

export type SnowClient = {
  getPointForecasts: (pos: { latitude: number; longitude: number }) => Promise<WeatherData[]>
  clear: () => void
}

export function createSnowClient(args: {
  http: HttpClient
  metfcstBaseUrl: string
  ttlSeconds: number
  keyDecimals: number
}): SnowClient {
  const cache = createAsyncCache(args.ttlSeconds)

  function makeUrl(pos: { latitude: number; longitude: number }): string {
    return `${args.metfcstBaseUrl}/category/snow1g/version/1/geotype/point/lon/${pos.longitude}/lat/${pos.latitude}/data.json`
  }

  return {
    async getPointForecasts(pos): Promise<WeatherData[]> {
      const key = `snow:point:${roundCoord(pos.latitude, args.keyDecimals)},${roundCoord(
        pos.longitude,
        args.keyDecimals
      )}`
      return cache.getOrSet(key, async () => {
        const json = await args.http.getJson<SnowPointResponse>(makeUrl(pos))
        return json.timeSeries.map((ts): WeatherData => mapSnowTsToPoint(ts))
      })
    },
    clear: () => cache.clear()
  }
}

export function mapSnowTsToPoint(ts: SnowTimeSeriesEntry): WeatherData {
  const d = ts.data ?? {}

  // Parameter names per SNOW docs; keep this mapping small and expand later.
  // https://opendata.smhi.se/metfcst/snow1gv1/parameters
  const temperatureC = num(d, 'air_temperature')
  const pressureHpa = num(d, 'air_pressure_at_mean_sea_level')
  const humidity = num(d, 'relative_humidity')
  const cloudCover = num(d, 'cloud_area_fraction')
  const visibilityM = num(d, 'visibility_in_air')
  const precipMm = num(d, 'total_precipitation_amount')
  const windSpeed = num(d, 'wind_speed')
  const windDir = num(d, 'wind_from_direction')
  const gust = num(d, 'wind_speed_of_gust')
  const dewPointC = num(d, 'dew_point_temperature')
  const symbol = num(d, 'symbol_code')

  const outside: NonNullable<WeatherData['outside']> = {}
  if (typeof temperatureC === 'number') outside.temperature = cToCelsius(temperatureC)
  if (typeof dewPointC === 'number') outside.dewPointTemperature = cToCelsius(dewPointC)
  if (typeof pressureHpa === 'number') outside.pressure = hPaToPa(pressureHpa)
  if (typeof humidity === 'number') outside.relativeHumidity = humidity
  if (typeof cloudCover === 'number') outside.cloudCover = cloudCover
  if (typeof visibilityM === 'number') outside.horizontalVisibility = visibilityM
  if (typeof precipMm === 'number') outside.precipitationVolume = precipMm

  const wind: NonNullable<WeatherData['wind']> = {}
  if (typeof windSpeed === 'number') wind.speedTrue = windSpeed
  if (typeof windDir === 'number') wind.directionTrue = windDir
  if (typeof gust === 'number') wind.gust = gust

  const description =
    typeof symbol === 'number' ? `smhi.symbol_code=${symbol}` : undefined

  return {
    date: ts.time,
    type: 'point',
    ...(description ? { description } : {}),
    ...(Object.keys(outside).length ? { outside } : {}),
    ...(Object.keys(wind).length ? { wind } : {})
  }
}

export function deriveDailyFromPointSeries(pointSeries: WeatherData[]): WeatherData[] {
  // Group by UTC day based on ISO timestamp.
  const byDay = new Map<string, WeatherData[]>()
  for (const w of pointSeries) {
    const dayKey = w.date.slice(0, 10) // YYYY-MM-DD
    const list = byDay.get(dayKey) ?? []
    list.push(w)
    byDay.set(dayKey, list)
  }

  const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))

  return days.map(([day, items]): WeatherData => {
    const temps = items
      .map((i) => i.outside?.temperature)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const winds = items
      .map((i) => i.wind?.speedTrue)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const gusts = items
      .map((i) => i.wind?.gust)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const precip = items
      .map((i) => i.outside?.precipitationVolume)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const clouds = items
      .map((i) => i.outside?.cloudCover)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

    const outside: NonNullable<WeatherData['outside']> = {}
    if (temps.length) {
      outside.minTemperature = Math.min(...temps)
      outside.maxTemperature = Math.max(...temps)
    }
    if (precip.length) outside.precipitationVolume = precip.reduce((a, b) => a + b, 0)
    if (clouds.length) outside.cloudCover = clouds.reduce((a, b) => a + b, 0) / clouds.length

    const wind: NonNullable<WeatherData['wind']> = {}
    if (winds.length) wind.speedTrue = winds.reduce((a, b) => a + b, 0) / winds.length
    if (gusts.length) wind.gust = Math.max(...gusts)

    return {
      date: `${day}T00:00:00.000Z`,
      type: 'daily',
      ...(Object.keys(outside).length ? { outside } : {}),
      ...(Object.keys(wind).length ? { wind } : {})
    }
  })
}

