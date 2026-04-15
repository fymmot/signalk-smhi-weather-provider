import { LRUCache } from 'lru-cache'

export type AsyncCache = {
  getOrSet: <T>(key: string, loader: () => Promise<T>) => Promise<T>
  clear: () => void
}

export function createAsyncCache(ttlSeconds: number): AsyncCache {
  const cache = new LRUCache<string, any>({
    max: 2000,
    ttl: ttlSeconds * 1000
  })

  const inflight = new Map<string, Promise<unknown>>()

  return {
    async getOrSet<T>(key: string, loader: () => Promise<T>): Promise<T> {
      const existing = cache.get(key) as T | undefined
      if (typeof existing !== 'undefined') return existing

      const running = inflight.get(key) as Promise<T> | undefined
      if (running) return running

      const p = (async () => {
        try {
          const value = await loader()
          cache.set(key, value)
          return value
        } finally {
          inflight.delete(key)
        }
      })()

      inflight.set(key, p as Promise<unknown>)
      return p
    },
    clear() {
      inflight.clear()
      cache.clear()
    }
  }
}

