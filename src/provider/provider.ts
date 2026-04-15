import type {
  Position,
  WeatherData,
  WeatherForecastType,
  WeatherProviderMethods,
  WeatherReqParams,
  WeatherWarning
} from '../types'
import type { PluginApp } from '../types'
import type { PluginConfig } from '../config'
import { createHttpClient } from '../http'
import { createSnowClient, deriveDailyFromPointSeries } from './smhiSnow'
import { createMetobsClient } from './smhiMetobs'
import { createWarningsClient } from './smhiWarnings'

export function createSmhiWeatherProviderMethods(
  app: PluginApp,
  config: PluginConfig
): { methods: WeatherProviderMethods; stop: () => void } {
  const http = createHttpClient(config.network.timeoutMs)

  const snow = createSnowClient({
    http,
    metfcstBaseUrl: config.smhi.metfcstBaseUrl,
    ttlSeconds: config.cache.ttlSecondsForecasts,
    keyDecimals: config.cache.keyDecimals
  })

  const metobs = createMetobsClient({
    http,
    metobsBaseUrl: config.smhi.metobsBaseUrl,
    ttlSeconds: config.cache.ttlSecondsObservations,
    keyDecimals: config.cache.keyDecimals
  })

  const warnings = createWarningsClient({
    http,
    warningsBaseUrl: config.smhi.warningsBaseUrl,
    warningsFeedPath: config.smhi.warningsFeedPath,
    ttlSeconds: config.cache.ttlSecondsWarnings,
    keyDecimals: config.cache.keyDecimals,
    log: {
      debug: (m) => config.logging.debug && app.debug(m),
      error: (m) => app.error(m)
    }
  })

  const methods: WeatherProviderMethods = {
    async getForecasts(
      position: Position,
      type: WeatherForecastType,
      options?: WeatherReqParams
    ): Promise<WeatherData[]> {
      const series = await snow.getPointForecasts(position)
      const limited = limitAsc(series, options?.maxCount)
      if (type === 'point') return limited
      const daily = deriveDailyFromPointSeries(series)
      return limitAsc(daily, options?.maxCount)
    },

    async getObservations(position: Position, options?: WeatherReqParams): Promise<WeatherData[]> {
      return metobs.getObservations(position, {
        maxCount: options?.maxCount,
        maxStationDistanceKm: config.observations.maxStationDistanceKm
      })
    },

    async getWarnings(_position: Position): Promise<WeatherWarning[]> {
      return warnings.getWarnings(_position)
    }
  }

  return {
    methods,
    stop: () => {
      snow.clear()
      metobs.clear()
      warnings.clear()
      if (config.logging.debug) app.debug('[smhi-weather-provider] stopped')
    }
  }
}

function limitAsc<T>(items: T[], maxCount?: number): T[] {
  if (!maxCount || maxCount <= 0) return items
  return items.slice(0, maxCount)
}

