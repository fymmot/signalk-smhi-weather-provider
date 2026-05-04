# signalk-smhi-weather-provider

Signal K Node Server **weather provider plugin** for the [Signal K Weather API](https://demo.signalk.org/documentation/Developing/REST_APIs/Weather_API.html). It registers a provider that maps **SMHI Open Data** into the server’s weather response schema ([Weather providers](https://demo.signalk.org/documentation/Developing/Plugins/Weather_Providers.html)).

## Capabilities

| Dataset | `/signalk/v2/api/weather/...` | Notes |
|--------|-------------------------------|--------|
| **Observations** | `.../observations` | Nearest **MetObs** station |
| **Forecasts** | `.../forecasts/point`, `.../forecasts/daily` | MetFcst **SNOW1gv1** (`snow1g` v1) point steps + derived daily |
| **Warnings** | `.../warnings` | SMHI impact-based warnings (CAP 1.2 JSON) |

Upstream APIs are configurable in plugin settings (defaults point at SMHI’s open-data hosts).

## Installation

Plugins install into the Signal K **server configuration directory** (default `$HOME/.signalk`). See [Server plugins](https://demo.signalk.org/documentation/Developing/Plugins.html).

### From the App Store (recommended)

Npm package: **`signalk-smhi-weather-provider`** (keywords `signalk-node-server-plugin`, `signalk-category-weather`). In the Admin UI: **Appstore** → **Available** (optionally filter by the **weather** category) → find the package → install → **Restart** the server → **Server → Plugin Config** to enable and configure. Details: [Install Plugins and Webapps](https://demo.signalk.org/documentation/Configuration.html#install-plugins-and-webapps).

The App Store uses `npm install --ignore-scripts`; this package ships a built `dist/` via **`prepack`** before publish. See [Publishing to The AppStore](https://demo.signalk.org/documentation/Developing/Plugins/Publishing_to_The_AppStore.html).

### From the command line

```bash
cd ~/.signalk
npm install signalk-smhi-weather-provider
```

Restart Signal K Server, then enable the plugin under **Server → Plugin Config**.

### Local clone or `npm link` (development)

```bash
cd ~/.signalk
npm install /absolute/path/to/smhi-sk-weather-provider
```

For iterative work, use **`npm link`**: run `npm link` in the plugin repo, then `npm link signalk-smhi-weather-provider` from `~/.signalk`. See [Link your project to Signal K server](https://demo.signalk.org/documentation/Developing/Plugins.html#link-your-project-to-signalk-server).

## Using the Weather API

All routes are rooted at **`/signalk/v2/api/weather`**. Requests must include a position: **`lat`** and **`lon`** (WGS84). Optional **`count`** limits how many observations or forecast steps are returned (see the [Weather API](https://demo.signalk.org/documentation/Developing/REST_APIs/Weather_API.html) examples).

With several providers installed, **`provider`** selects the plugin by its id (this plugin’s id is **`smhi-weather-provider`**). List installed providers:

```http
GET /signalk/v2/api/weather/_providers
```

Default routing uses the server’s default provider unless you pass **`provider`**. Set default: `POST /signalk/v2/api/weather/_providers/_default/{id}` (documented on the same Weather API page).

### Example queries

Replace `localhost:3000` with your server host/port. Use **`&provider=`** when `lat`/`lon` are already in the query string.

**Latest observation from SMHI only**

```http
GET /signalk/v2/api/weather/observations?lat=59.33&lon=18.07&provider=smhi-weather-provider
```

**Point forecast (12 steps) from SMHI only**

```http
GET /signalk/v2/api/weather/forecasts/point?lat=59.33&lon=18.07&count=12&provider=smhi-weather-provider
```

**Warnings for the same position**

```http
GET /signalk/v2/api/weather/warnings?lat=59.33&lon=18.07&provider=smhi-weather-provider
```

Example with `curl`:

```bash
curl -sS "http://localhost:3000/signalk/v2/api/weather/observations?lat=59.33&lon=18.07&provider=smhi-weather-provider"
```

Response shapes are defined by the server’s Weather API **OpenAPI** description (Admin UI: **Documentation → OpenAPI**).

## Units

This plugin returns **SI-style** values in line with typical Weather API usage:

- **Temperature**: °C  
- **Pressure**: Pa  
- **Wind speed**: m/s  
- **Wind direction**: degrees true  
- **Precipitation**: mm (point steps); daily totals summed in mm  

## Configuration notes

- **Warnings feed**: if SMHI changes the active-warnings URL, adjust **`smhi.warningsFeedPath`** in plugin config when warnings return `404`.

## Development

```bash
cd smhi-sk-weather-provider
npm install
npm test
npm run build
node dist/smoke.js
```
