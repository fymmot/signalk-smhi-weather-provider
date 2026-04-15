import type {
  Position,
  WeatherData,
  WeatherForecastType,
  WeatherProvider,
  WeatherProviderMethods,
  WeatherReqParams,
  WeatherWarning
} from '@signalk/server-api'

export type {
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
  registerWeatherProvider: (provider: WeatherProvider) => void
  setPluginStatus?: (msg: string) => void
  setPluginError?: (msg: string) => void
}

