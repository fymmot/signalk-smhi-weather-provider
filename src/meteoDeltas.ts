import { SKVersion } from '@signalk/server-api'
import type { Context, Delta, Path, PathValue, Position, WeatherData } from '@signalk/server-api'

/**
 * Emit a v1 delta update for a dedicated meteo context (e.g. `smhi`),
 * mapping the latest {@link WeatherData} observation onto `navigation.position`
 * and `environment.*` paths — same general approach as common weather-provider plugins.
 */
export function emitObservationMeteoDeltas(args: {
  handleMessage: (id: string, msg: Partial<Delta>, skVersion?: SKVersion) => void
  pluginId: string
  /** Signal K context id for this synthetic source (not `vessels.self`). */
  context: string
  position: Position
  obs: WeatherData
}): void {
  const env = 'environment'
  const values: PathValue[] = []

  const push = (path: string, value: PathValue['value'] | undefined) => {
    if (value === undefined) return
    values.push({ path: path as Path, value })
  }

  push('navigation.position', {
    latitude: args.position.latitude,
    longitude: args.position.longitude,
    ...(typeof args.position.altitude === 'number' ? { altitude: args.position.altitude } : {})
  })

  const obs = args.obs
  if (typeof obs.date === 'string') push(`${env}.date`, obs.date)

  const o = obs.outside
  if (o) {
    push(`${env}.outside.temperature`, o.temperature)
    push(`${env}.outside.dewPointTemperature`, o.dewPointTemperature)
    push(`${env}.outside.feelsLikeTemperature`, o.feelsLikeTemperature)
    push(`${env}.outside.minTemperature`, o.minTemperature)
    push(`${env}.outside.maxTemperature`, o.maxTemperature)
    push(`${env}.outside.pressure`, o.pressure)
    push(`${env}.outside.pressureTendency`, o.pressureTendency)
    push(`${env}.outside.relativeHumidity`, o.relativeHumidity)
    push(`${env}.outside.absoluteHumidity`, o.absoluteHumidity)
    push(`${env}.outside.cloudCover`, o.cloudCover)
    push(`${env}.outside.horizontalVisibility`, o.horizontalVisibility)
    push(`${env}.outside.uvIndex`, o.uvIndex)
    push(`${env}.outside.precipitationVolume`, o.precipitationVolume)
    push(`${env}.outside.precipitationType`, o.precipitationType)
  }

  const sun = obs.sun
  if (sun) {
    push(`${env}.sun.sunrise`, sun.sunrise)
    push(`${env}.sun.sunset`, sun.sunset)
  }

  const w = obs.water
  if (w) {
    push(`${env}.water.temperature`, w.temperature)
    push(`${env}.water.level`, w.level)
    push(`${env}.water.levelTendency`, w.levelTendency)
    push(`${env}.water.salinity`, w.salinity)
    push(`${env}.water.surfaceCurrentSpeed`, w.surfaceCurrentSpeed)
    push(`${env}.water.surfaceCurrentDirection`, w.surfaceCurrentDirection)
    push(`${env}.water.waveSignificantHeight`, w.waveSignificantHeight)
    push(`${env}.water.wavePeriod`, w.wavePeriod)
    push(`${env}.water.waveDirection`, w.waveDirection)
    push(`${env}.water.swellHeight`, w.swellHeight)
    push(`${env}.water.swellPeriod`, w.swellPeriod)
    push(`${env}.water.swellDirection`, w.swellDirection)
  }

  const wind = obs.wind
  if (wind) {
    push(`${env}.wind.speedTrue`, wind.speedTrue)
    push(`${env}.wind.directionTrue`, wind.directionTrue)
    push(`${env}.wind.gust`, wind.gust)
    push(`${env}.wind.gustDirection`, wind.gustDirection)
  }

  if (values.length <= 1) {
    // Only navigation.position — nothing useful to emit
    return
  }

  args.handleMessage(
    args.pluginId,
    {
      context: args.context as Context,
      updates: [{ values }]
    },
    SKVersion.v1
  )
}
