import { DEFAULT_SETTINGS, PUBLIC_STATUS_PAGES, instantiateDefaultServices } from './defaults.js';

const STORAGE_KEY = 'statusBoard.web.data';

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// Ne corriger que les anciennes URL exactes : aucune personnalisation externe n'est écrasée.
const STATUS_URL_MIGRATIONS = [
  { oldOrigin: 'https://www.calendlystatus.com', current: PUBLIC_STATUS_PAGES.calendly },
  { oldOrigin: 'https://new.cloudflarestatus.com', current: PUBLIC_STATUS_PAGES.cloudflare }
];

function migrateKnownServices(store) {
  if (!Array.isArray(store.services)) return false;

  let changed = false;
  store.services = store.services.map((service) => {
    const pageUrl = String(service.pageUrl || '');
    const endpoint = String(service.endpoint || '');
    const looksLikeGoHighLevel =
      /status\.gohighlevel\.com/i.test(pageUrl)
      || /api\.pulsetic\.com\/public\/status\/status\.gohighlevel\.com/i.test(endpoint);

    if (looksLikeGoHighLevel && service.provider !== 'betterstack') {
      changed = true;
      return {
        ...service,
        pageUrl: 'https://status.gohighlevel.com',
        endpoint: 'https://status.gohighlevel.com/index.json',
        provider: 'betterstack',
        method: 'GET',
        updatedAt: new Date().toISOString()
      };
    }

    // Les pages Statuspage sont identifiées par leurs anciennes URL, même si
    // l'utilisateur a renommé le service. Les autres champs restent inchangés.
    if (service.provider !== 'atlassian') return service;
    let nextPageUrl = pageUrl;
    let nextEndpoint = endpoint;
    for (const { oldOrigin, current } of STATUS_URL_MIGRATIONS) {
      if (pageUrl.replace(/\/$/, '') === oldOrigin) nextPageUrl = current.pageUrl;
      if (endpoint.replace(/\/$/, '') === `${oldOrigin}/api/v2/summary.json`) {
        nextEndpoint = current.endpoint;
      }
    }
    if (nextPageUrl === pageUrl && nextEndpoint === endpoint) return service;

    changed = true;
    return {
      ...service,
      pageUrl: nextPageUrl,
      endpoint: nextEndpoint,
      updatedAt: new Date().toISOString()
    };
  });

  return changed;
}

export async function initialiseStorage({ forceDefaults = false } = {}) {
  const store = readStore();
  if (forceDefaults || !Array.isArray(store.services)) store.services = instantiateDefaultServices();
  if (forceDefaults || !store.settings) store.settings = { ...DEFAULT_SETTINGS };
  if (forceDefaults) {
    store.statuses = {};
    store.lastRefreshAt = null;
  }
  // Lancer une nouvelle vérification dès l'ouverture après correction des URL.
  if (migrateKnownServices(store)) store.lastRefreshAt = null;
  writeStore(store);
}

export async function getServices() {
  const store = readStore();
  return Array.isArray(store.services) ? store.services : [];
}

export async function saveServices(services) {
  const store = readStore();
  store.services = services;
  writeStore(store);
}

export async function upsertService(service) {
  const services = await getServices();
  const index = services.findIndex((item) => item.id === service.id);
  if (index >= 0) services[index] = service;
  else services.push(service);
  await saveServices(services);
  return services;
}

export async function removeService(id) {
  const services = (await getServices()).filter((service) => service.id !== id);
  await saveServices(services);
  const statuses = await getStatuses();
  delete statuses[id];
  await saveStatuses(statuses);
  return services;
}

export async function getSettings() {
  const store = readStore();
  return { ...DEFAULT_SETTINGS, ...(store.settings || {}) };
}

export async function saveSettings(settings) {
  const clean = {
    refreshMinutes: Math.max(5, Number(settings.refreshMinutes) || DEFAULT_SETTINGS.refreshMinutes),
    notificationsEnabled: Boolean(settings.notificationsEnabled),
    viewMode: ['cards', 'table'].includes(settings.viewMode) ? settings.viewMode : DEFAULT_SETTINGS.viewMode,
    cardDensity: ['comfortable', 'compact', 'dense'].includes(settings.cardDensity) ? settings.cardDensity : DEFAULT_SETTINGS.cardDensity,
    sortMode: ['alphabetical', 'status'].includes(settings.sortMode) ? settings.sortMode : DEFAULT_SETTINGS.sortMode,
    issuesOnly: settings.issuesOnly === true
  };
  const store = readStore();
  store.settings = clean;
  writeStore(store);
  return clean;
}

export async function getStatuses() {
  return readStore().statuses || {};
}

export async function saveStatuses(statuses) {
  const store = readStore();
  store.statuses = statuses;
  writeStore(store);
}

export async function getLastRefreshAt() {
  return readStore().lastRefreshAt || null;
}

export async function setLastRefreshAt(value) {
  const store = readStore();
  store.lastRefreshAt = value;
  writeStore(store);
}

export async function exportConfig() {
  const [services, settings] = await Promise.all([getServices(), getSettings()]);
  return { version: 1, exportedAt: new Date().toISOString(), services, settings };
}

export async function importConfig(payload) {
  const services = Array.isArray(payload) ? payload : payload?.services;
  if (!Array.isArray(services)) throw new Error('Le fichier ne contient pas une liste de services valide.');
  const cleaned = services.map((service) => ({
    id: service.id || crypto.randomUUID(),
    name: String(service.name || '').trim(),
    pageUrl: String(service.pageUrl || '').trim(),
    endpoint: String(service.endpoint || '').trim(),
    provider: String(service.provider || '').trim(),
    method: service.method === 'POST' ? 'POST' : 'GET',
    enabled: service.enabled !== false,
    createdAt: service.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  if (cleaned.some((s) => !s.name || !s.pageUrl || !s.endpoint || !s.provider)) {
    throw new Error('Certains services importés sont incomplets.');
  }
  await saveServices(cleaned);
  if (!Array.isArray(payload) && payload.settings) await saveSettings(payload.settings);
  return cleaned;
}
