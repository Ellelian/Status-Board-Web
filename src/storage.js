import { DEFAULT_SETTINGS, instantiateDefaultServices } from './defaults.js';

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

export async function initialiseStorage({ forceDefaults = false } = {}) {
  const store = readStore();
  if (forceDefaults || !Array.isArray(store.services)) store.services = instantiateDefaultServices();
  if (forceDefaults || !store.settings) store.settings = { ...DEFAULT_SETTINGS };
  if (forceDefaults) {
    store.statuses = {};
    store.lastRefreshAt = null;
  }
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
