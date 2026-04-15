import { createSmhiWeatherProviderMethods } from './provider/provider'
import { coerceConfig } from './config'

async function main() {
  const app = {
    debug: console.log,
    error: console.error,
    registerWeatherProvider: () => {}
  }

  const config = coerceConfig({
    logging: { debug: true }
  })

  const { methods } = createSmhiWeatherProviderMethods(app, config)

  const pos = { latitude: 59.3315, longitude: 18.066 } // Stockholm

  console.log('forecasts/point')
  console.log(await methods.getForecasts(pos, 'point', { maxCount: 3 }))

  console.log('forecasts/daily')
  console.log(await methods.getForecasts(pos, 'daily', { maxCount: 3 }))

  console.log('observations')
  console.log(await methods.getObservations(pos, { maxCount: 3 }))

  console.log('warnings')
  console.log(await methods.getWarnings(pos))
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

