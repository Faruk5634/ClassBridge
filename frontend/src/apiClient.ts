const pendingGetRequests = new Map<string, Promise<Response>>()
const cachedGetResponses = new Map<string, { response: Response; expiresAt: number }>()
const cacheEpochByAuthorization = new Map<string, number>()

function requestParts(input: RequestInfo | URL, init: RequestInit) {
  const requestMethod = init.method ?? (input instanceof Request ? input.method : 'GET')
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined))
  const url = input instanceof Request ? input.url : String(input)
  return { requestMethod: requestMethod.toUpperCase(), headers, url }
}

/** Share a currently running GET request between identical component effects. */
export function fetchDeduplicated(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { requestMethod, headers, url } = requestParts(input, init)
  if (requestMethod !== 'GET') return fetch(input, init)
  const key = `${url}\n${headers.get('Authorization') ?? ''}`
  const existing = pendingGetRequests.get(key)
  if (existing) return existing.then((response) => response.clone())

  const pending = fetch(input, init)
  pendingGetRequests.set(key, pending)
  void pending.finally(() => {
    if (pendingGetRequests.get(key) === pending) pendingGetRequests.delete(key)
  }).catch(() => {})
  return pending.then((response) => response.clone())
}

/** Reuse successful API GET responses briefly across route/component remounts. */
export async function fetchCached(input: RequestInfo | URL, init: RequestInit = {}, maxAgeMs = 30_000): Promise<Response> {
  const { requestMethod, headers, url } = requestParts(input, init)
  const authorization = headers.get('Authorization') ?? ''
  if (requestMethod !== 'GET') {
    try { return await fetch(input, init) }
    finally { if (authorization) invalidateCachedGetRequests(authorization) }
  }

  const key = `${url}\n${authorization}`
  const now = Date.now()
  const cached = cachedGetResponses.get(key)
  if (cached && cached.expiresAt > now) return cached.response.clone()
  if (cached) cachedGetResponses.delete(key)

  const requestEpoch = cacheEpochByAuthorization.get(authorization) ?? 0
  const response = await fetchDeduplicated(input, init)
  if (response.ok && maxAgeMs > 0 && requestEpoch === (cacheEpochByAuthorization.get(authorization) ?? 0)) {
    for (const [cachedKey, value] of cachedGetResponses) if (value.expiresAt <= now) cachedGetResponses.delete(cachedKey)
    while (cachedGetResponses.size >= 100) {
      const oldestKey = cachedGetResponses.keys().next().value as string | undefined
      if (oldestKey === undefined) break
      cachedGetResponses.delete(oldestKey)
    }
    cachedGetResponses.set(key, { response: response.clone(), expiresAt: now + maxAgeMs })
  }
  return response
}

/** Invalidate cached GETs for an authenticated session, optionally filtered by URL. */
export function invalidateCachedGetRequests(authorization: string, matchesUrl?: (url: string) => boolean) {
  cacheEpochByAuthorization.set(authorization, (cacheEpochByAuthorization.get(authorization) ?? 0) + 1)
  const suffix = `\n${authorization}`
  for (const key of cachedGetResponses.keys()) {
    if (!key.endsWith(suffix)) continue
    const url = key.slice(0, -suffix.length)
    if (!matchesUrl || matchesUrl(url)) cachedGetResponses.delete(key)
  }
  // A request started before a write must not be shared with a read after the write.
  for (const key of pendingGetRequests.keys()) {
    if (!key.endsWith(suffix)) continue
    const url = key.slice(0, -suffix.length)
    if (!matchesUrl || matchesUrl(url)) pendingGetRequests.delete(key)
  }
}
