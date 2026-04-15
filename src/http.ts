export type HttpClient = {
  getJson: <T>(url: string) => Promise<T>
}

export function createHttpClient(timeoutMs: number): HttpClient {
  return {
    async getJson<T>(url: string): Promise<T> {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { accept: 'application/json' },
          signal: controller.signal
        })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status} for ${url}${body ? `: ${body.slice(0, 500)}` : ''}`)
        }
        return (await res.json()) as T
      } finally {
        clearTimeout(timeout)
      }
    }
  }
}

