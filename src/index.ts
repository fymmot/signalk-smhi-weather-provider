import type { Plugin, WeatherProvider } from '@signalk/server-api'
import { VESSEL_POLL_INTERVAL_MINUTES, coerceConfig } from './config'
import type { PluginApp, Position, WeatherForecastType, WeatherReqParams } from './types'
import { createSmhiWeatherProviderMethods } from './provider/provider'
import { startVesselPoll, stopVesselPoll } from './vesselPoll'

/** v1 delta context for polled meteo (not `vessels.self`). */
const METEO_DELTA_CONTEXT = 'smhi'

// Only user-relevant options are exposed. The provider works with no configuration;
// SMHI endpoints, cache TTLs and network timeout keep sensible defaults (see config.ts).
const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    vesselPoll: {
      type: 'object',
      title: 'Track vessel position',
      description:
        'Periodically fetch weather for your current position and publish it on the Signal K stream (context "smhi"), so weather follows the boat. Off by default; the Weather API works regardless.',
      properties: {
        enable: {
          type: 'boolean',
          title: 'Follow the vessel position',
          default: false
        },
        pollIntervalMinutes: {
          type: 'number',
          title: 'Update interval (minutes)',
          enum: [...VESSEL_POLL_INTERVAL_MINUTES],
          default: 60
        }
      }
    },
    observations: {
      type: 'object',
      title: 'Observations',
      properties: {
        maxStationDistanceKm: {
          type: 'number',
          title: 'Max weather-station distance (km)',
          default: 150,
          description:
            'Observations come from the nearest SMHI station. If none is within this distance, observations are empty.'
        }
      }
    },
    logging: {
      type: 'object',
      title: 'Advanced',
      properties: {
        debug: { type: 'boolean', title: 'Debug logging', default: false }
      }
    },
    smhi: {
      type: 'object',
      title: 'Advanced — SMHI warnings',
      properties: {
        warningsFeedPath: {
          type: 'string',
          title: 'Warnings feed path',
          default: '/ibww/active.json',
          description: 'Only change this if warnings stop working because SMHI moved their feed.'
        }
      }
    }
  }
}

const CONFIG_UISCHEMA = {
  vesselPoll: {
    enable: { 'ui:widget': 'checkbox' },
    pollIntervalMinutes: { 'ui:widget': 'select' }
  },
  logging: {
    debug: { 'ui:widget': 'checkbox' }
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

        startVesselPoll({
          app,
          enable: config.vesselPoll.enable,
          pollIntervalMinutes: config.vesselPoll.pollIntervalMinutes,
          loggingDebug: config.logging.debug,
          label: plugin.id,
          pluginId: plugin.id,
          meteoContext: METEO_DELTA_CONTEXT,
          fetchObservations: (position) => methods.getObservations(position, { maxCount: 1 })
        })

        app.setPluginStatus?.('Started')
        if (config.logging.debug) app.debug(`[${plugin.id}] weather provider registered`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        app.setPluginError?.(msg)
        app.error(msg)
      }
    },
    stop: () => {
      stopVesselPoll()
      stopProvider?.()
      stopProvider = undefined
      app.setPluginStatus?.('Stopped')
    }
  }

  return plugin
}

