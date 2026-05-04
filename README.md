# signalk-smhi-weather-provider

Signal K **weather provider** backed by [SMHI](https://www.smhi.se/) open data: MetObs observations, SNOW1gv1 point forecasts (+ derived daily), and impact-based warnings.

**Plugin id:** `smhi-weather-provider` — use `provider=smhi-weather-provider` on the [Weather API](https://demo.signalk.org/documentation/Developing/REST_APIs/Weather_API.html) if you run multiple providers.

## Install

1. **App Store:** Admin UI → **Appstore** → **Available** → install `signalk-smhi-weather-provider` → **Restart** → **Server → Plugin Config** → enable.
2. **CLI:** `cd ~/.signalk && npm install signalk-smhi-weather-provider` → restart server → enable in Plugin Config.

Local dev: `npm link` in the repo, then `npm link signalk-smhi-weather-provider` from `~/.signalk` ([plugin dev](https://demo.signalk.org/documentation/Developing/Plugins.html#link-your-project-to-signalk-server)).

## Call the API

Base path: `/signalk/v2/api/weather`. Required query params: `lat`, `lon`. Optional: `count`, `provider`.

```http
GET /signalk/v2/api/weather/observations?lat=59.33&lon=18.07&provider=smhi-weather-provider
GET /signalk/v2/api/weather/forecasts/point?lat=59.33&lon=18.07&count=12&provider=smhi-weather-provider
GET /signalk/v2/api/weather/warnings?lat=59.33&lon=18.07&provider=smhi-weather-provider
```

List providers: `GET /signalk/v2/api/weather/_providers`. Response shapes: Admin → **Documentation → OpenAPI**.

**Units (typical):** °C, Pa, m/s, wind direction degrees true, precipitation mm.

## Plugin config (high level)

- SMHI base URLs and **warnings path** — if warnings 404, adjust `smhi.warningsFeedPath`.
- **Vessel position polling** (off by default): when on, periodically fetches from `navigation.position` and always emits v1 meteo deltas on context **`smhi`** (plus HTTP cache warmup).

## Development

```bash
npm install && npm test && npm run build && node dist/smoke.js
```
