import { detectStatusPage } from './detector.js';
import { checkService } from './status-engine.js';
import {
  initialiseStorage,
  getServices,
  upsertService,
  removeService,
  getSettings,
  saveSettings,
  getStatuses,
  saveStatuses,
  getLastRefreshAt,
  setLastRefreshAt,
  exportConfig,
  importConfig
} from './storage.js';
import { STATUS_META, statusScore } from './utils.js';

let refreshTimer = null;
let initialised = false;

export async function initialiseWebApp() {
  if (initialised) return;
  await initialiseStorage();
  initialised = true;

  // À l'ouverture, les statuts ne doivent pas rester affichés au-delà
  // de la fréquence demandée dans les réglages.
  await refreshIfStaleOrSchedule({ allowNotifications: false });
}

export async function dispatch(type, payload = {}) {
  await initialiseWebApp();
  switch (type) {
    case 'GET_STATE':
      return getState();
    case 'DETECT_SERVICE':
      return detectStatusPage(payload.pageUrl);
    case 'SAVE_SERVICE':
      return saveService(payload.service);
    case 'DELETE_SERVICE':
      await removeService(payload.id);
      return getState();
    case 'REFRESH_ALL':
      // Un rafraîchissement manuel complet redémarre le délai automatique.
      await refreshAll({ allowNotifications: false, resetTimer: true });
      return getState();
    case 'REFRESH_ONE':
      await refreshOne(payload.id);
      return getState();
    case 'SAVE_SETTINGS':
      await saveSettings(payload.settings);
      // Si le nouveau délai rend les données déjà périmées, vérifie immédiatement.
      // Sinon, planifie le prochain contrôle à l'échéance réelle.
      await refreshIfStaleOrSchedule({ allowNotifications: false });
      return getState();
    case 'RESTORE_DEFAULTS':
      await initialiseStorage({ forceDefaults: true });
      await refreshAll({ allowNotifications: false, resetTimer: true });
      return getState();
    case 'EXPORT_CONFIG':
      return exportConfig();
    case 'IMPORT_CONFIG':
      await importConfig(payload.payload);
      await refreshAll({ allowNotifications: false, resetTimer: true });
      return getState();
    default:
      throw new Error('Action inconnue.');
  }
}

async function getState() {
  const [services, settings, statuses, lastRefreshAt] = await Promise.all([
    getServices(), getSettings(), getStatuses(), getLastRefreshAt()
  ]);
  return { services, settings, statuses, lastRefreshAt };
}

async function saveService(input) {
  const now = new Date().toISOString();
  const service = {
    id: input.id || crypto.randomUUID(),
    name: String(input.name || '').trim(),
    pageUrl: normaliseHttpsUrl(input.pageUrl, 'URL publique'),
    endpoint: normaliseHttpsUrl(input.endpoint, 'URL sondée'),
    provider: String(input.provider || '').trim(),
    method: input.method === 'POST' ? 'POST' : 'GET',
    enabled: input.enabled !== false,
    createdAt: input.createdAt || now,
    updatedAt: now
  };
  if (!service.name) throw new Error('Le nom du service est obligatoire.');
  if (!['atlassian', 'instatus', 'incidentio', 'pulsetic', 'google', 'sorryapp', 'statusio-html'].includes(service.provider)) {
    throw new Error('Le type de page de statut est invalide.');
  }
  await upsertService(service);
  await refreshOne(service.id);
  return getState();
}

function normaliseHttpsUrl(value, label) {
  let parsed;
  try { parsed = new URL(String(value || '').trim()); }
  catch { throw new Error(`${label} invalide.`); }
  if (parsed.protocol !== 'https:') throw new Error(`${label} doit commencer par https://.`);
  return parsed.href.replace(/\/$/, '');
}

function refreshDelayMs(settings) {
  const minutes = Math.max(5, Number(settings.refreshMinutes) || 5);
  return minutes * 60 * 1000;
}

function clearRefreshTimer() {
  if (!refreshTimer) return;
  clearTimeout(refreshTimer);
  refreshTimer = null;
}

async function scheduleRefresh(delayOverrideMs) {
  clearRefreshTimer();
  const settings = await getSettings();
  const delay = Number.isFinite(delayOverrideMs)
    ? Math.max(0, delayOverrideMs)
    : refreshDelayMs(settings);

  refreshTimer = setTimeout(async () => {
    try {
      await refreshAll({ allowNotifications: true, resetTimer: true });
    } catch (error) {
      console.error('[refresh]', error);
      // En cas d'échec imprévu, on ne coupe pas définitivement l'actualisation.
      await scheduleRefresh();
    }
  }, delay);
}

async function refreshIfStaleOrSchedule({ allowNotifications }) {
  const [settings, lastRefreshAt] = await Promise.all([getSettings(), getLastRefreshAt()]);
  const interval = refreshDelayMs(settings);
  const lastTimestamp = lastRefreshAt ? new Date(lastRefreshAt).getTime() : NaN;
  const elapsed = Number.isFinite(lastTimestamp) ? Math.max(0, Date.now() - lastTimestamp) : Infinity;
  const remaining = interval - elapsed;

  if (remaining <= 0) {
    await refreshAll({ allowNotifications, resetTimer: true });
    return;
  }

  await scheduleRefresh(remaining);
}

async function refreshAll({ allowNotifications, resetTimer = false }) {
  const [services, previous, settings] = await Promise.all([getServices(), getStatuses(), getSettings()]);
  const checks = await Promise.all(services.map((service) => checkService(service)));
  const statuses = Object.fromEntries(checks.map((check) => [check.serviceId, check]));
  const timestamp = new Date().toISOString();
  await Promise.all([saveStatuses(statuses), setLastRefreshAt(timestamp)]);
  if (allowNotifications && settings.notificationsEnabled) notifyTransitions(services, previous, statuses);
  window.dispatchEvent(new CustomEvent('statusboard:updated'));
  if (resetTimer) await scheduleRefresh();
  return statuses;
}

async function refreshOne(id) {
  const services = await getServices();
  const service = services.find((item) => item.id === id);
  if (!service) throw new Error('Service introuvable.');
  const statuses = await getStatuses();
  statuses[id] = await checkService(service);
  await saveStatuses(statuses);

  // Une vérification individuelle ne remplace pas une actualisation complète :
  // elle ne modifie ni l'horodatage global ni le prochain contrôle automatique.
  return statuses[id];
}

function notifyTransitions(services, previous, current) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  for (const service of services.filter((item) => item.enabled)) {
    const oldLevel = previous[service.id]?.level || 'ok';
    const newStatus = current[service.id];
    if (!newStatus || !['minor', 'major', 'maintenance'].includes(newStatus.level)) continue;
    if (statusScore(newStatus.level) <= statusScore(oldLevel)) continue;
    new Notification(`${service.name} : ${STATUS_META[newStatus.level].label}`, {
      body: newStatus.title || 'Une alerte est en cours sur la page de statut.',
      icon: 'icons/icon128.png'
    });
  }
}
