export type PluginConfig = {
  smhi: {
    metfcstBaseUrl: string
    metobsBaseUrl: string
    warningsBaseUrl: string
    warningsFeedPath: string
  }
  cache: {
    ttlSecondsForecasts: number
    ttlSecondsObservations: number
    ttlSecondsWarnings: number
    keyDecimals: number
  }
  network: {
    timeoutMs: number
  }
  observations: {
    maxStationDistanceKm: number
  }
  logging: {
    debug: boolean
  }
}

export const DEFAULT_CONFIG: PluginConfig = {
  smhi: {
    metfcstBaseUrl: 'https://opendata-download-metfcst.smhi.se/api',
    metobsBaseUrl: 'https://opendata-download-metobs.smhi.se/api',
    warningsBaseUrl: 'https://opendata-download-warnings.smhi.se',
    // NOTE: SMHI's exact “active warnings feed” path is subject to change; keep configurable.
    // This default is a conservative placeholder; if it 404s in your environment, set it in plugin settings.
    warningsFeedPath: '/ibww/active.json'
  },
  cache: {
    ttlSecondsForecasts: 60,
    ttlSecondsObservations: 60,
    ttlSecondsWarnings: 120,
    keyDecimals: 3
  },
  network: {
    timeoutMs: 8000
  },
  observations: {
    maxStationDistanceKm: 150
  },
  logging: {
    debug: false
  }
}

export function coerceConfig(raw: unknown): PluginConfig {
  const obj = (raw ?? {}) as Partial<PluginConfig>
  return {
    smhi: {
      metfcstBaseUrl: obj.smhi?.metfcstBaseUrl ?? DEFAULT_CONFIG.smhi.metfcstBaseUrl,
      metobsBaseUrl: obj.smhi?.metobsBaseUrl ?? DEFAULT_CONFIG.smhi.metobsBaseUrl,
      warningsBaseUrl: obj.smhi?.warningsBaseUrl ?? DEFAULT_CONFIG.smhi.warningsBaseUrl,
      warningsFeedPath: obj.smhi?.warningsFeedPath ?? DEFAULT_CONFIG.smhi.warningsFeedPath
    },
    cache: {
      ttlSecondsForecasts:
        obj.cache?.ttlSecondsForecasts ?? DEFAULT_CONFIG.cache.ttlSecondsForecasts,
      ttlSecondsObservations:
        obj.cache?.ttlSecondsObservations ?? DEFAULT_CONFIG.cache.ttlSecondsObservations,
      ttlSecondsWarnings: obj.cache?.ttlSecondsWarnings ?? DEFAULT_CONFIG.cache.ttlSecondsWarnings,
      keyDecimals: obj.cache?.keyDecimals ?? DEFAULT_CONFIG.cache.keyDecimals
    },
    network: {
      timeoutMs: obj.network?.timeoutMs ?? DEFAULT_CONFIG.network.timeoutMs
    },
    observations: {
      maxStationDistanceKm:
        obj.observations?.maxStationDistanceKm ?? DEFAULT_CONFIG.observations.maxStationDistanceKm
    },
    logging: {
      debug: obj.logging?.debug ?? DEFAULT_CONFIG.logging.debug
    }
  }
}

