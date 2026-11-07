# Changelog

## 0.2.1

- Add an App Store icon and a readable name ("SMHI Weather Provider").

No change to the plugin's behaviour.

## 0.2.0

### Breaking

- Weather data now follows the Signal K weather schema's SI units instead of SMHI's
  display units: temperature in K, wind direction in rad, relative humidity and cloud
  cover as ratios (0–1), visibility in m, precipitation in m. Clients that assumed °C,
  degrees, percent, oktas, km or mm must convert.

### Fixed

- Observations read wind direction and speed from the right SMHI MetObs parameters
  (3 and 4). Before, direction came from the daily mean temperature and speed from the
  direction, with a guess to tell them apart.
- Point forecasts carry precipitation again: read SNOW1g's
  `precipitation_amount_mean`, so `outside.precipitationVolume` and daily rain totals
  are no longer missing.
- Drop the dew point read; SNOW1g does not publish it.

### Other

- Run the shared Signal K plugin CI on every push.
- Add a changelog and App Store screenshots.

## 0.1.0

First release.

- Weather provider for SMHI open data: observations from the nearest SMHI station,
  hourly point forecasts with a derived daily summary, and SMHI's impact-based weather
  warnings.
- Optional polling of the vessel's position, publishing weather on the Signal K stream
  in an `smhi` context.
