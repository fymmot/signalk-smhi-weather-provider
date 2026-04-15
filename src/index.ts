import type { Plugin, WeatherProvider } from '@signalk/server-api'
import { coerceConfig } from './config'
import type { PluginApp, Position, WeatherForecastType, WeatherReqParams } from './types'
import { createSmhiWeatherProviderMethods } from './provider/provider'

const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    smhi: {
      type: 'object',
      title: 'SMHI endpoints',
      properties: {
        metfcstBaseUrl: {
          type: 'string',
          title: 'MetFcst base URL',
          default: 'https://opendata-download-metfcst.smhi.se/api'
        },
        metobsBaseUrl: {
          type: 'string',
          title: 'MetObs base URL',
          default: 'https://opendata-download-metobs.smhi.se/api'
        },
        warningsBaseUrl: {
          type: 'string',
          title: 'Warnings base URL',
          default: 'https://opendata-download-warnings.smhi.se'
        },
        warningsFeedPath: {
          type: 'string',
          title: 'Warnings feed path',
          default: '/ibww/active.json',
          description:
            'Path appended to Warnings base URL. Update if SMHI changes their active feed endpoint.'
        }
      }
    },
    cache: {
      type: 'object',
      title: 'Caching',
      properties: {
        ttlSecondsForecasts: { type: 'number', title: 'Forecasts TTL (s)', default: 60 },
        ttlSecondsObservations: { type: 'number', title: 'Observations TTL (s)', default: 60 },
        ttlSecondsWarnings: { type: 'number', title: 'Warnings TTL (s)', default: 120 },
        keyDecimals: {
          type: 'number',
          title: 'Lat/Lon cache key decimals',
          default: 3,
          description: 'Rounding applied to cache keys only (not requests).'
        }
      }
    },
    network: {
      type: 'object',
      title: 'Network',
      properties: {
        timeoutMs: { type: 'number', title: 'HTTP timeout (ms)', default: 8000 }
      }
    },
    observations: {
      type: 'object',
      title: 'Observations',
      properties: {
        maxStationDistanceKm: {
          type: 'number',
          title: 'Max station distance (km)',
          default: 150,
          description: 'If the nearest suitable station is farther away, observations may be empty.'
        }
      }
    },
    logging: {
      type: 'object',
      title: 'Logging',
      properties: {
        debug: { type: 'boolean', title: 'Debug logging', default: false }
      }
    }
  }
}

const CONFIG_UISCHEMA = {
  logging: {
    debug: {
      'ui:widget': 'checkbox',
      'ui:title': 'Debug logging'
    }
  }
}

module.exports = function (app: PluginApp): Plugin {
  let stopProvider: (() => void) | undefined

  const plugin: Plugin = {
    id: 'smhi-weather-provider',
    name: 'SMHI Weather Provider',
    description:
      'Signal K v2 Weather Provider using SMHI Open Data (SNOW1gv1 forecasts, MetObs observations, CAP warnings).',
    schema: () => CONFIG_SCHEMA,
    uiSchema: () => CONFIG_UISCHEMA,
    start: (settings: unknown) => {
      try {
        if (typeof app.registerWeatherProvider !== 'function') {
          throw new Error('Weather API is not available! Server upgrade required.')
        }

        const config = coerceConfig(settings)
        const { methods, stop } = createSmhiWeatherProviderMethods(app, config)
        stopProvider = stop

        const weatherProvider: WeatherProvider = {
          name: 'SMHI',
          methods: {
            pluginId: plugin.id,
            getObservations: async (position: Position, options?: WeatherReqParams) =>
              methods.getObservations(position, options),
            getForecasts: async (
              position: Position,
              type: WeatherForecastType,
              options?: WeatherReqParams
            ) => methods.getForecasts(position, type, options),
            getWarnings: async (position: Position) => methods.getWarnings(position)
          }
        }

        app.registerWeatherProvider(weatherProvider)
        app.setPluginStatus?.('Started')
        if (config.logging.debug) app.debug(`[${plugin.id}] weather provider registered`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        app.setPluginError?.(msg)
        app.error(msg)
      }
    },
    stop: () => {
      stopProvider?.()
      stopProvider = undefined
      app.setPluginStatus?.('Stopped')
    }
  }

  return plugin
}

