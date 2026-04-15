import type { WeatherWarning } from '../types'
import type { HttpClient } from '../http'
import { createAsyncCache } from '../cache'
import { pointInPolygon, roundCoord } from '../geo'

type SmhiIbwWarning = {
  event?: { en?: string; sv?: string; code?: string }
  warningAreas?: SmhiIbwWarningArea[]
}

type SmhiIbwWarningArea = {
  approximateStart?: string
  approximateEnd?: string
  published?: string
  warningLevel?: { en?: string; sv?: string; code?: string }
  areaName?: { en?: string; sv?: string }
  descriptions?: Array<{
    title?: { code?: string; en?: string; sv?: string }
    text?: { en?: string; sv?: string }
  }>
  area?: {
    type?: string
    geometry?: {
      type?: 'Polygon' | 'MultiPolygon'
      coordinates?: any
    }
  }
}

function toPolygons(area: SmhiIbwWarningArea): Array<Array<{ latitude: number; longitude: number }>> {
  const geom = area.area?.geometry
  if (!geom?.type || !geom.coordinates) return []

  if (geom.type === 'Polygon') {
    // coordinates: [ [ [lon,lat], ... ] , (holes...) ]
    const outer = (geom.coordinates?.[0] ?? []) as Array<[number, number]>
    return [outer.map(([lon, lat]) => ({ latitude: lat, longitude: lon }))]
  }

  if (geom.type === 'MultiPolygon') {
    // coordinates: [ polygon1, polygon2, ... ] where polygon = [ outerRing, holes... ]
    const polys = geom.coordinates as Array<Array<Array<[number, number]>>>
    return polys.map((p) => (p?.[0] ?? []).map(([lon, lat]) => ({ latitude: lat, longitude: lon })))
  }

  return []
}

function bestDetails(area: SmhiIbwWarningArea): string {
  const desc = area.descriptions ?? []
  const incident = desc.find((d) => d.title?.code === 'INCIDENT')
  const affect = desc.find((d) => d.title?.code === 'AFFECT')
  const where = desc.find((d) => d.title?.code === 'WHERE')
  return (
    incident?.text?.en ??
    incident?.text?.sv ??
    affect?.text?.en ??
    affect?.text?.sv ??
    where?.text?.en ??
    where?.text?.sv ??
    area.areaName?.en ??
    area.areaName?.sv ??
    'SMHI warning'
  )
}

export type WarningsClient = {
  getWarnings: (pos: { latitude: number; longitude: number }) => Promise<WeatherWarning[]>
  clear: () => void
}

export function createWarningsClient(args: {
  http: HttpClient
  warningsBaseUrl: string
  warningsFeedPath: string
  ttlSeconds: number
  keyDecimals: number
  log?: { debug?: (msg: string) => void; error?: (msg: string) => void }
}): WarningsClient {
  const cache = createAsyncCache(args.ttlSeconds)

  function url(): string {
    return `${args.warningsBaseUrl}${args.warningsFeedPath}`
  }

  return {
    async getWarnings(pos): Promise<WeatherWarning[]> {
      const key = `warn:${roundCoord(pos.latitude, args.keyDecimals)},${roundCoord(
        pos.longitude,
        args.keyDecimals
      )}`
      try {
        return await cache.getOrSet(key, async () => {
          const feed = await args.http.getJson<SmhiIbwWarning[]>(url())
        const out: WeatherWarning[] = []

        for (const w of feed ?? []) {
          for (const area of w.warningAreas ?? []) {
            const polys = toPolygons(area)
            if (!polys.length) continue
            const applies = polys.some((p) => pointInPolygon(pos, p))
            if (!applies) continue

            const start = area.approximateStart ?? area.published
            const end = area.approximateEnd ?? area.approximateStart ?? area.published
            if (!start || !end) continue

            const event = w.event?.en ?? w.event?.sv ?? w.event?.code ?? 'Warning'
            const level = area.warningLevel?.en ?? area.warningLevel?.sv ?? area.warningLevel?.code
            const type = level ? `${event} (${level})` : event

            out.push({
              startTime: start,
              endTime: end,
              details: bestDetails(area),
              source: 'SMHI',
              type
            })
          }
        }

        // Required: ascending date order.
        return out.sort((a, b) => a.startTime.localeCompare(b.startTime))
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        args.log?.error?.(`[smhi-warnings] ${msg}`)
        return []
      }
    },
    clear: () => cache.clear()
  }
}

