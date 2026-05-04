import { describe, expect, it, vi } from 'vitest'
import { SKVersion } from '@signalk/server-api'
import { emitObservationMeteoDeltas } from '../src/meteoDeltas'

describe('emitObservationMeteoDeltas', () => {
  it('calls handleMessage with context smhi and v1 environment paths', () => {
    const handleMessage = vi.fn()
    emitObservationMeteoDeltas({
      handleMessage,
      pluginId: 'smhi-weather-provider',
      context: 'smhi',
      position: { latitude: 59.3, longitude: 18.1 },
      obs: {
        date: '2026-05-04T12:00:00.000Z',
        type: 'observation',
        outside: { temperature: 10.5, pressure: 101_000 },
        wind: { speedTrue: 5.1, directionTrue: 200, gust: 8.2 }
      }
    })
    expect(handleMessage).toHaveBeenCalledTimes(1)
    const [id, msg, sk] = handleMessage.mock.calls[0]
    expect(id).toBe('smhi-weather-provider')
    expect(sk).toBe(SKVersion.v1)
    expect(msg.context).toBe('smhi')
    const values = msg.updates?.[0]?.values ?? []
    const paths = values.map((v: { path: string }) => v.path)
    expect(paths).toContain('navigation.position')
    expect(paths).toContain('environment.outside.temperature')
    expect(paths).toContain('environment.wind.speedTrue')
  })
})
