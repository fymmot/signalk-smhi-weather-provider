export function roundCoord(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)

  const sin1 = Math.sin(dLat / 2)
  const sin2 = Math.sin(dLon / 2)
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return R * c
}

export function pointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: Array<{ latitude: number; longitude: number }>
): boolean {
  // Ray casting algorithm. Polygon must be non-self-intersecting. Works for typical CAP polygons.
  const x = point.longitude
  const y = point.latitude
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.longitude
    const yi = polygon[i]!.latitude
    const xj = polygon[j]!.longitude
    const yj = polygon[j]!.latitude

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

