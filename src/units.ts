// SMHI publishes display units; Signal K WeatherData is SI (K, Pa, m, rad) and ratios 0–1.
// See WeatherDataModelSchema in @signalk/server-api.

export function celsiusToKelvin(c: number): number {
  return c + 273.15
}

export function hPaToPa(hpa: number): number {
  return hpa * 100
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function percentToRatio(percent: number): number {
  return percent / 100
}

export function oktasToRatio(oktas: number): number {
  return oktas / 8
}

export function kmToM(km: number): number {
  return km * 1000
}

export function mmToM(mm: number): number {
  return mm / 1000
}
