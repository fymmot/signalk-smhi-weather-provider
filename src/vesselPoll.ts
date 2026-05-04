import type { Delta, SKVersion, WeatherData } from '@signalk/server-api'
import { emitObservationMeteoDeltas } from './meteoDeltas'
import type { Position } from './types'

/** Wake timer: check position often; upstream fetch is throttled by poll interval. */
const WAKE_INTERVAL_MS = 60_000
const START_DELAY_MS = 3000
/** If two wakes occur this close together, treat the timer as stuck and stop polling. */
const WATCHDOG_MIN_MS = WAKE_INTERVAL_MS - 10_000

let timer: ReturnType<typeof setInterval> | undefined
let startTimer: ReturnType<typeof setTimeout> | undefined
let lastWakeMs = 0
let lastFetchMs = 0

/**
 * Parse `app.getSelfPath('navigation.position')` into a WGS84 position.
 */
export function parseNavigationPosition(raw: unknown): Position | null {
  if (raw == null || typeof raw !== 'object') return null
  const value = (raw as { value?: unknown }).value
  if (value == null || typeof value !== 'object') return null
  const lat = (value as { latitude?: unknown }).latitude
  const lon = (value as { longitude?: unknown }).longitude
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { latitude: lat, longitude: lon }
}

export type VesselPollApp = {
  debug: (msg: string, ...args: unknown[]) => void
  error: (msg: string, ...args: unknown[]) => void
  getSelfPath: (path: string) => unknown
  handleMessage: (id: string, msg: Partial<Delta>, skVersion?: SKVersion) => void
  setPluginError?: (msg: string) => void
}

export type VesselPollOptions = {
  app: VesselPollApp
  /** When false, no timers are started (default in plugin config). */
  enable: boolean
  pollIntervalMinutes: number
  loggingDebug: boolean
  /** Shown in logs / errors, e.g. plugin id. */
  label: string
  pluginId: string
  /** Dedicated Signal K context for meteo deltas (not `vessels.self`). */
  meteoContext: string
  fetchObservations: (position: Position) => Promise<WeatherData[]>
}

export function stopVesselPoll(): void {
  if (timer) clearInterval(timer)
  if (startTimer) clearTimeout(startTimer)
  timer = undefined
  startTimer = undefined
  lastWakeMs = 0
  lastFetchMs = 0
}

/**
 * Periodically read `navigation.position` and run {@link VesselPollOptions.fetchObservations}
 * when {@link VesselPollOptions.pollIntervalMinutes} has elapsed since the last successful fetch.
 * Off by default.
 */
export function startVesselPoll(opts: VesselPollOptions): void {
  stopVesselPoll()
  if (!opts.enable) return

  const pollMs = Math.max(1, opts.pollIntervalMinutes) * 60_000

  const run = async () => {
    if (lastWakeMs > 0) {
      const dt = Date.now() - lastWakeMs
      if (dt < WATCHDOG_MIN_MS) {
        opts.app.debug(
          `[${opts.label}] vessel poll watchdog (${Math.round(dt / 1000)}s since last wake), stopping`
        )
        stopVesselPoll()
        opts.app.setPluginError?.(`${opts.label}: vessel poll stopped (watchdog)`)
        return
      }
    }
    lastWakeMs = Date.now()

    const position = parseNavigationPosition(opts.app.getSelfPath('navigation.position'))
    if (!position) {
      if (opts.loggingDebug) {
        opts.app.debug(`[${opts.label}] vessel poll: no navigation.position`)
      }
      return
    }

    if (lastFetchMs > 0) {
      const elapsed = Date.now() - lastFetchMs
      if (elapsed < pollMs) {
        if (opts.loggingDebug) {
          opts.app.debug(
            `[${opts.label}] vessel poll: next fetch in ~${Math.round((pollMs - elapsed) / 60000)} min`
          )
        }
        return
      }
    }

    try {
      const rows = await opts.fetchObservations(position)
      lastFetchMs = Date.now()
      lastWakeMs = Date.now()

      const obs = rows[0]
      if (obs && typeof opts.app.handleMessage === 'function') {
        emitObservationMeteoDeltas({
          handleMessage: opts.app.handleMessage,
          pluginId: opts.pluginId,
          context: opts.meteoContext,
          position,
          obs
        })
        if (opts.loggingDebug) {
          opts.app.debug(`[${opts.label}] vessel poll: emitted meteo deltas for context "${opts.meteoContext}"`)
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      opts.app.error(`[${opts.label}] vessel poll: ${msg}`)
      opts.app.setPluginError?.(`${opts.label}: poll failed — ${msg}`)
    }
  }

  startTimer = setTimeout(() => {
    startTimer = undefined
    void run()
    timer = setInterval(() => void run(), WAKE_INTERVAL_MS)
  }, START_DELAY_MS)
}
