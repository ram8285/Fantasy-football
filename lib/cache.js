// Tiny in-memory TTL cache. Values are cached per key; stale values are kept
// around so callers can fall back to them when a refresh fails. Failures are
// negatively cached so an unreachable source doesn't stall every request.
const store = new Map();
const failures = new Map();
const FAILURE_TTL_MS = 60 * 1000;

export function getCached(key, maxAgeMs) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > maxAgeMs) return undefined;
  return entry.value;
}

export function getStale(key) {
  return store.get(key)?.value;
}

export function setCached(key, value) {
  store.set(key, { value, at: Date.now() });
}

// Fetch-through helper: return fresh cache if present, otherwise call fn().
// If fn() throws and a stale value exists, serve the stale value instead.
export async function cached(key, maxAgeMs, fn) {
  const fresh = getCached(key, maxAgeMs);
  if (fresh !== undefined) return { value: fresh, stale: false };
  const lastFailure = failures.get(key);
  if (lastFailure && Date.now() - lastFailure.at < FAILURE_TTL_MS) {
    const stale = getStale(key);
    if (stale !== undefined) return { value: stale, stale: true };
    throw lastFailure.err;
  }
  try {
    const value = await fn();
    setCached(key, value);
    failures.delete(key);
    return { value, stale: false };
  } catch (err) {
    failures.set(key, { err, at: Date.now() });
    const stale = getStale(key);
    if (stale !== undefined) return { value: stale, stale: true };
    throw err;
  }
}
