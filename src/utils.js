export const STATUS_META = {
  ok: { label: 'Opérationnel', score: 0 },
  maintenance: { label: 'Maintenance en cours', score: 1 },
  minor: { label: 'Incident partiel', score: 2 },
  major: { label: 'Incident majeur', score: 3 },
  error: { label: 'Erreur de lecture', score: -1 },
  disabled: { label: 'Désactivé', score: -1 }
};

const NETWORK_KEY = 'statusBoard.network';
export const DEFAULT_NETWORK_SETTINGS = {
  proxyFallbackEnabled: true,
  corsProxyBase: 'https://corsproxy.io/?'
};

export function getNetworkSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(NETWORK_KEY) || '{}');
    return {
      proxyFallbackEnabled: saved.proxyFallbackEnabled !== false,
      corsProxyBase: String(saved.corsProxyBase || DEFAULT_NETWORK_SETTINGS.corsProxyBase).trim()
    };
  } catch {
    return { ...DEFAULT_NETWORK_SETTINGS };
  }
}

export function saveNetworkSettings(settings) {
  const clean = {
    proxyFallbackEnabled: settings.proxyFallbackEnabled !== false,
    corsProxyBase: String(settings.corsProxyBase || DEFAULT_NETWORK_SETTINGS.corsProxyBase).trim()
      || DEFAULT_NETWORK_SETTINGS.corsProxyBase
  };
  localStorage.setItem(NETWORK_KEY, JSON.stringify(clean));
  return clean;
}

export function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function statusScore(level) {
  return STATUS_META[level]?.score ?? -1;
}

export function mapImpact(value) {
  const impact = normalize(value);
  if (['critical', 'major', 'major_outage', 'majoroutage', 'major_system_outage'].includes(impact)) return 'major';
  if (['maintenance', 'under_maintenance', 'scheduled'].includes(impact)) return 'maintenance';
  if (['minor', 'partial', 'partial_outage', 'partial_system_outage', 'degraded_performance', 'degraded', 'warning'].includes(impact)) return 'minor';
  if (['none', 'ok', 'operational', 'up', 'available', 'resolved', 'completed'].includes(impact)) return 'ok';
  return 'minor';
}

export function isClosed(value) {
  return ['resolved', 'completed', 'closed', 'fixed', 'available', 'postmortem'].includes(normalize(value));
}

export function safeMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error ?? 'Erreur inconnue');
}

function proxiedUrl(url) {
  const { corsProxyBase } = getNetworkSettings();
  return `${corsProxyBase}${encodeURIComponent(url)}`;
}

async function requestWithCorsFallback(url, options = {}) {
  const requestOptions = {
    method: options.method || 'GET',
    cache: 'no-store',
    redirect: 'follow',
    headers: options.headers || {}
  };
  let directError;
  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) throw new Error(`HTTP ${response.status} — ${url}`);
    return { response, finalUrl: response.url || url, usedProxy: false };
  } catch (error) {
    directError = error;
  }

  const network = getNetworkSettings();
  if (!network.proxyFallbackEnabled) throw directError;

  try {
    const response = await fetch(proxiedUrl(url), requestOptions);
    if (!response.ok) throw new Error(`HTTP ${response.status} — ${url}`);
    // L'URL finale du proxy ne doit jamais remplacer l'endpoint réel enregistré.
    return { response, finalUrl: url, usedProxy: true };
  } catch (proxyError) {
    throw new Error(`${safeMessage(proxyError)} (accès direct et proxy indisponibles)`);
  }
}

export async function fetchJson(url, options = {}) {
  const { response, finalUrl, usedProxy } = await requestWithCorsFallback(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json();
  return { data, finalUrl, response, usedProxy };
}

export async function fetchText(url, options = {}) {
  const { response, finalUrl, usedProxy } = await requestWithCorsFallback(url, {
    ...options,
    headers: { Accept: 'text/html,application/xhtml+xml', ...(options.headers || {}) }
  });
  return { text: await response.text(), finalUrl, response, usedProxy };
}

export function formatRelativeTime(iso) {
  if (!iso) return 'Jamais vérifié';
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  const seconds = Math.round(delta / 1000);
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

export function toServiceId(name) {
  return String(name || 'service')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'service';
}
