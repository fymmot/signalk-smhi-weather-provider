import type {
  Delta,
  Plugin,
  Position,
  SKVersion,
  WeatherData,
  WeatherForecastType,
  WeatherProvider,
  WeatherProviderMethods,
  WeatherReqParams,
  WeatherWarning
} from '@signalk/server-api'

export type {
  Plugin,
  Position,
  WeatherData,
  WeatherForecastType,
  WeatherProvider,
  WeatherProviderMethods,
  WeatherReqParams,
  WeatherWarning
}

export type PluginApp = {
  debug: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  getSelfPath: (path: string) => unknown
  handleMessage: (id: string, msg: Partial<Delta>, skVersion?: SKVersion) => void
  registerWeatherProvider: (provider: WeatherProvider) => void
  setPluginStatus?: (msg: string) => void
  setPluginError?: (msg: string) => void
}

