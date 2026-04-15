# signalk-smhi-weather-provider

Signal K Node Server **Weather Provider** plugin that serves `/signalk/v2/api/weather/*` using **SMHI Open Data**:

- **Forecasts**: SMHI MetFcst **SNOW1gv1** (`snow1g`, version 1) point forecasts, and derived daily forecasts.
- **Observations**: SMHI **MetObs** (nearest station observations).
- **Warnings**: SMHI **impact-based warnings** (CAP 1.2 JSON).

## Install

From your Signal K server machine:

```bash
npm install -g signalk-smhi-weather-provider
```

Then enable/configure it in the Signal K admin UI under **Server → Plugin Config**.

## Weather API endpoints

Signal K server exposes the Weather API at:

- `GET /signalk/v2/api/weather/observations?lat=59.3&lon=18.1&count=5`
- `GET /signalk/v2/api/weather/forecasts/point?lat=59.3&lon=18.1&count=12`
- `GET /signalk/v2/api/weather/forecasts/daily?lat=59.3&lon=18.1&count=7`
- `GET /signalk/v2/api/weather/warnings?lat=59.3&lon=18.1`

To pick a specific provider, use the `provider` query parameter with the plugin id:

- `GET /signalk/v2/api/weather/forecasts/point?lat=59.3&lon=18.1&provider=smhi-weather-provider`

## Units

This plugin outputs **SI** units in the Weather API response objects:

- **Temperature**: °C (Celsius)
- **Pressure**: Pa
- **Wind speed**: m/s
- **Wind direction**: degrees true
- **Precipitation volume**: mm for point steps; daily is summed mm

If you want Kelvin temperatures or precipitation in meters, it’s a straightforward change in the mapping layer.

## Configuration notes

- **Warnings feed**: SMHI may change the “active warnings” endpoint path; update `smhi.warningsFeedPath` if you get `404` from warnings.

## Development

```bash
npm install
npm test
npm run build
node dist/smoke.js
```

