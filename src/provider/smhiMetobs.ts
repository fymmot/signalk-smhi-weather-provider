import type { WeatherData } from '../types'
import type { HttpClient } from '../http'
import { createAsyncCache } from '../cache'
import { haversineKm, roundCoord } from '../geo'

type WeatherDataWithStation = WeatherData & {
  // Provider-specific extension used by BoatTracker for station labeling + distance.
  station?: {
    name?: string
    position: { latitude: number; longitude: number }
  }
}

type MetobsValue = {
  date: number
  value: string
  quality?: string
}

type MetobsStation = {
  key: string
  name?: string
  latitude: number
  longitude: number
  height?: number
  value?: MetobsValue[]
}

type MetobsParameterResponse = {
  parameter?: { key: string; name?: string; unit?: string }
  period?: { key: string; from?: number; to?: number }
  station: MetobsStation[]
}

type MetobsStationPeriodResponse = {
  station?: { key: string }
  position?: Array<{ latitude: number; longitude: number }>
  value?: MetobsValue[]
}

export type MetobsClient = {
  getObservations: (
    pos: { latitude: number; longitude: number },
    options?: { maxCount?: number; maxStationDistanceKm: number }
  ) => Promise<WeatherData[]>
  clear: () => void
}

const DEFAULT_PARAMS = {
  // Parameter 1 is confirmed by live API response: "Lufttemperatur" (celsius).
  temperature: 1,
  // Wind direction / speed / humidity parameter codes vary by product docs; keep configurable later if needed.
  windDirection: 2,
  windSpeed: 3,
  relativeHumidity: 6
} as const

function pickLatest(v?: MetobsValue[]): MetobsValue | undefined {
  if (!v || v.length === 0) return undefined
  return v.reduce((a, b) => (b.date > a.date ? b : a))
}

function parseNumber(value?: MetobsValue): number | undefined {
  if (!value) return undefined
  const n = Number(value.value)
  if (!Number.isFinite(n)) return undefined
  return n
}

export function createMetobsClient(args: {
  http: HttpClient
  metobsBaseUrl: string
  ttlSeconds: number
  keyDecimals: number
}): MetobsClient {
  const cache = createAsyncCache(args.ttlSeconds)

  function latestHourUrl(parameterId: number): string {
    return `${args.metobsBaseUrl}/version/1.0/parameter/${parameterId}/station-set/all/period/latest-hour/data.json`
  }

  function latestDayStationUrl(parameterId: number, stationKey: string): string {
    return `${args.metobsBaseUrl}/version/1.0/parameter/${parameterId}/station/${stationKey}/period/latest-day/data.json`
  }

  return {
    async getObservations(pos, options): Promise<WeatherData[]> {
      const maxCount = options?.maxCount
      const maxStationDistanceKm = options?.maxStationDistanceKm ?? 150

      const key = `metobs:obs:${roundCoord(pos.latitude, args.keyDecimals)},${roundCoord(
        pos.longitude,
        args.keyDecimals
      )}:${maxCount ?? 0}`

      return cache.getOrSet(key, async () => {
        // Step 1: choose nearest station based on latest temperature feed (parameter 1).
        const temp = await args.http.getJson<MetobsParameterResponse>(latestHourUrl(DEFAULT_PARAMS.temperature))
        const candidates = temp.station
          .filter((s) => pickLatest(s.value))
          .map((s) => ({
            station: s,
            distKm: haversineKm(pos, { latitude: s.latitude, longitude: s.longitude })
          }))
          .sort((a, b) => a.distKm - b.distKm)

        const best = candidates[0]
        if (!best || best.distKm > maxStationDistanceKm) return []

        const stationKey = best.station.key
        const stationName = best.station.name
        const stationLat = best.station.latitude
        const stationLon = best.station.longitude

        // Step 2: fetch latest-day series for selected station for each parameter.
        const [tRes, wsRes, wdRes, rhRes] = await Promise.all([
          args.http.getJson<MetobsStationPeriodResponse>(latestDayStationUrl(DEFAULT_PARAMS.temperature, stationKey)),
          args.http.getJson<MetobsStationPeriodResponse>(latestDayStationUrl(DEFAULT_PARAMS.windSpeed, stationKey)).catch(
            () => ({ value: [] } as MetobsStationPeriodResponse)
          ),
          args.http.getJson<MetobsStationPeriodResponse>(latestDayStationUrl(DEFAULT_PARAMS.windDirection, stationKey)).catch(
            () => ({ value: [] } as MetobsStationPeriodResponse)
          ),
          args.http.getJson<MetobsStationPeriodResponse>(latestDayStationUrl(DEFAULT_PARAMS.relativeHumidity, stationKey)).catch(
            () => ({ value: [] } as MetobsStationPeriodResponse)
          )
        ])

        const tValues = tRes.value ?? []
        if (!tValues.length) return []
        const wsValues = wsRes.value ?? []
        const wdValues = wdRes.value ?? []
        const rhValues = rhRes.value ?? []

        // Index values by timestamp (ms) for join.
        const byTime = new Map<number, WeatherDataWithStation>()
        for (const v of tValues) {
          const tempC = Number(v.value)
          if (!Number.isFinite(tempC)) continue
          byTime.set(v.date, {
            date: new Date(v.date).toISOString(),
            type: 'observation',
            outside: { temperature: tempC },
            // Provider-specific extension (not currently part of the core WeatherData type):
            // attach station identity + coordinates for distance computation in clients.
            station: {
              ...(stationName ? { name: stationName } : {}),
              position: { latitude: stationLat, longitude: stationLon }
            }
          })
        }

        function mergeSeries(
          values: MetobsValue[] | undefined,
          fn: (w: WeatherDataWithStation, n: number) => void
        ) {
          if (!values) return
          for (const v of values) {
            const w = byTime.get(v.date)
            if (!w) continue
            const n = Number(v.value)
            if (!Number.isFinite(n)) continue
            fn(w, n)
          }
        }

        mergeSeries(wsValues, (w, n) => {
          // MetObs parameter IDs have varied in the wild. If a "speed" value looks like a compass
          // direction (e.g. 70), treat it as direction so clients don't show "70 m/s".
          // Also treat very high "speeds" as direction: >35 m/s is extreme, but direction in degrees is common.
          if (n > 35 && n <= 360) {
            const existing = w.wind ?? {}
            if (existing.directionTrue == null) {
              w.wind = { ...existing, directionTrue: n }
            }
            return
          }
          w.wind = { ...(w.wind ?? {}), speedTrue: n }
        })
        mergeSeries(wdValues, (w, n) => {
          w.wind = { ...(w.wind ?? {}), directionTrue: n }
        })
        mergeSeries(rhValues, (w, n) => {
          w.outside = { ...(w.outside ?? {}), relativeHumidity: n }
        })

        const out = Array.from(byTime.values()).sort((a, b) => b.date.localeCompare(a.date))
        if (!maxCount || maxCount <= 0) return out
        return out.slice(0, maxCount)
      })
    },
    clear: () => cache.clear()
  }
}

