/**
 * Read-only server-collected fallback for public providers that reject browser requests.
 * Never use a stale or malformed snapshot as a green status.
 */
import { REQUEST_TIMEOUT_MS } from './utils.js';

export const STATUS_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/Ellelian/Status-Board-Web/status-cache/status-snapshot.json';

const SUPPORTED_HOSTS = new Set([
  'status.pipedrive.com',
  'www.calendlystatus.com',
  'new.cloudflarestatus.com',
  'status.passcreator.com'
]);

const MAX_SNAPSHOT_AGE_MS = 20 * 60 * 1000;

export async function readStatusSnapshot(service, fetcher = fetch, now = Date.now()) {
  let host;
  try {
    host = new URL(service.pageUrl || service.endpoint).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (!SUPPORTED_HOSTS.has(host)) return null;

  const response = await fetcher(`${STATUS_SNAPSHOT_URL}?ts=${now}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) return null;

  const payload = await response.json();
  if (payload?.version !== 1 || typeof payload?.services !== 'object') return null;
  const record = payload.services?.[host];
  if (!record || !['ok', 'minor', 'major', 'maintenance'].includes(record.level)) return null;

  const checkedAtMs = Date.parse(record.checkedAt || '');
  const age = now - checkedAtMs;
  if (!Number.isFinite(age) || age < -60000 || age > MAX_SNAPSHOT_AGE_MS) return null;

  return {
    level: record.level,
    title: typeof record.title === 'string' ? record.title : '',
    checkedAt: record.checkedAt
  };
}
