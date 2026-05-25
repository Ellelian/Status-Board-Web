import { STATUS_META, formatRelativeTime, getNetworkSettings, saveNetworkSettings } from '../src/utils.js';
import { dispatch, initialiseWebApp } from '../src/web-app.js';

let state = { services: [], statuses: {}, settings: {}, lastRefreshAt: null };
let currentlyEditing = null;

const $ = (selector) => document.querySelector(selector);
const elements = {
  grid: $('#grid'),
  tableView: $('#tableView'),
  tableBody: $('#tableBody'),
  emptyState: $('#emptyState'),
  updatedAt: $('#updatedAt'),
  totalCount: $('#totalCount'),
  okCount: $('#okCount'),
  issueCount: $('#issueCount'),
  errorCount: $('#errorCount'),
  searchInput: $('#searchInput'),
  issuesOnly: $('#issuesOnly'),
  refreshBtn: $('#refreshBtn'),
  newServiceBtn: $('#newServiceBtn'),
  serviceDialog: $('#serviceDialog'),
  serviceDialogTitle: $('#serviceDialogTitle'),
  serviceForm: $('#serviceForm'),
  serviceId: $('#serviceId'),
  serviceName: $('#serviceName'),
  pageUrl: $('#pageUrl'),
  provider: $('#provider'),
  endpoint: $('#endpoint'),
  method: $('#method'),
  enabled: $('#enabled'),
  advancedFields: $('#advancedFields'),
  detectBtn: $('#detectBtn'),
  detectionResult: $('#detectionResult'),
  formError: $('#formError'),
  settingsBtn: $('#settingsBtn'),
  settingsDialog: $('#settingsDialog'),
  settingsForm: $('#settingsForm'),
  refreshMinutes: $('#refreshMinutes'),
  notificationsEnabled: $('#notificationsEnabled'),
  proxyFallbackEnabled: $('#proxyFallbackEnabled'),
  corsProxyBase: $('#corsProxyBase'),
  viewMode: $('#viewMode'),
  cardDensity: $('#cardDensity'),
  cardDensityField: $('#cardDensityField'),
  sortMode: $('#sortMode'),
  restoreDefaultsBtn: $('#restoreDefaultsBtn'),
  exportBtn: $('#exportBtn'),
  importBtn: $('#importBtn'),
  importFile: $('#importFile'),
  cardTemplate: $('#cardTemplate'),
  favicon: $('#favicon')
};

async function send(type, payload = {}) {
  return dispatch(type, payload);
}

async function loadState() {
  state = await send('GET_STATE');
  elements.issuesOnly.checked = state.settings.issuesOnly === true;
  render();
}

function render() {
  renderSummary();
  renderBoard();
  renderUpdatedAt();
}

function renderSummary() {
  const enabled = state.services.filter((service) => service.enabled);
  const statuses = enabled.map((service) => state.statuses[service.id]?.level || 'error');
  const issueCount = statuses.filter((level) => ['minor', 'major', 'maintenance'].includes(level)).length;
  const errorCount = statuses.filter((level) => level === 'error').length;

  elements.totalCount.textContent = String(enabled.length);
  elements.okCount.textContent = String(statuses.filter((level) => level === 'ok').length);
  elements.issueCount.textContent = String(issueCount);
  elements.errorCount.textContent = String(errorCount);
  updateFavicon(issueCount + errorCount);
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function updateFavicon(alertCount) {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context || !elements.favicon) return;

  // Fond du logo Status Board.
  roundedRect(context, 4, 4, 52, 52, 13);
  context.fillStyle = '#3159E6';
  context.fill();

  // Badge : vert sans compteur si tout va bien ; orange avec compteur sinon.
  const hasAlert = alertCount > 0;
  const value = alertCount > 99 ? '99+' : String(alertCount);
  const badgeRadius = hasAlert ? (value.length >= 3 ? 17 : value.length === 2 ? 15 : 13) : 12;
  const badgeX = 49;
  const badgeY = 49;

  context.beginPath();
  context.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  context.fillStyle = hasAlert ? '#FF9800' : '#4CAF50';
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = '#FFFFFF';
  context.stroke();

  if (hasAlert) {
    context.fillStyle = '#FFFFFF';
    context.font = `700 ${value.length >= 3 ? 14 : value.length === 2 ? 19 : 24}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(value, badgeX, badgeY + 1);
  }

  elements.favicon.href = canvas.toDataURL('image/png');
}

function renderUpdatedAt() {
  elements.updatedAt.textContent = state.lastRefreshAt
    ? `Dernière actualisation ${formatRelativeTime(state.lastRefreshAt)}`
    : 'Aucune actualisation effectuée.';
}

function statusFor(service) {
  return service.enabled
    ? (state.statuses[service.id] || { level: 'error', title: 'Pas encore vérifié', checkedAt: null })
    : { level: 'disabled', title: '', checkedAt: null };
}

function statusPriority(service) {
  const priority = {
    major: 0,
    minor: 1,
    maintenance: 2,
    error: 3,
    ok: 4,
    disabled: 5
  };
  return priority[statusFor(service).level] ?? 6;
}

function filteredServices() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const issuesOnly = elements.issuesOnly.checked;
  const sortMode = state.settings.sortMode || 'status';

  return [...state.services]
    .filter((service) => !query || service.name.toLowerCase().includes(query))
    .filter((service) => !issuesOnly || ['minor', 'major', 'maintenance', 'error'].includes(statusFor(service).level))
    .sort((a, b) => {
      if (sortMode === 'status') {
        const statusDifference = statusPriority(a) - statusPriority(b);
        if (statusDifference !== 0) return statusDifference;
      }
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });
}

function renderBoard() {
  const viewMode = state.settings.viewMode || 'table';
  const density = state.settings.cardDensity || 'compact';
  const services = filteredServices();

  const hasServices = services.length > 0;
  elements.emptyState.classList.toggle('hidden', hasServices);
  elements.grid.classList.toggle('hidden', viewMode !== 'cards' || !hasServices);
  elements.tableView.classList.toggle('hidden', viewMode !== 'table' || !hasServices);
  elements.grid.dataset.density = density;

  if (viewMode === 'table') renderTable(services);
  else renderCards(services);
}

function renderCards(services) {
  elements.grid.replaceChildren();

  services.forEach((service) => {
    const status = statusFor(service);
    const fragment = elements.cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.status-card');
    card.dataset.level = status.level;
    fragment.querySelector('.card-name').textContent = service.name;
    fragment.querySelector('.status-label').textContent = STATUS_META[status.level]?.label || status.level;
    fragment.querySelector('.checked-at').textContent = status.checkedAt ? formatRelativeTime(status.checkedAt) : 'Non vérifié';

    const incident = fragment.querySelector('.incident-title');
    if (status.title) {
      incident.textContent = status.title;
      incident.classList.remove('hidden');
    }

    const link = fragment.querySelector('.external-link');
    link.href = service.pageUrl;
    fragment.querySelector('.refresh-one').addEventListener('click', () => refreshOne(service.id));
    fragment.querySelector('.edit-one').addEventListener('click', () => openEditDialog(service));
    fragment.querySelector('.delete-one').addEventListener('click', () => deleteService(service));
    elements.grid.appendChild(fragment);
  });
}

function createActionButton(text, title, handler) {
  const button = document.createElement('button');
  button.className = 'mini-button';
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.textContent = text;
  button.addEventListener('click', handler);
  return button;
}

function renderTable(services) {
  elements.tableBody.replaceChildren();

  services.forEach((service) => {
    const status = statusFor(service);
    const row = document.createElement('tr');
    row.dataset.level = status.level;

    const serviceCell = document.createElement('th');
    serviceCell.scope = 'row';
    const name = document.createElement('a');
    name.className = 'table-service-name';
    name.href = service.pageUrl;
    name.target = '_blank';
    name.rel = 'noopener noreferrer';
    name.textContent = service.name;
    serviceCell.append(name);

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'table-status';
    badge.dataset.level = status.level;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = STATUS_META[status.level]?.label || status.level;
    badge.append(dot, label);
    statusCell.appendChild(badge);

    const incidentCell = document.createElement('td');
    incidentCell.className = 'table-incident';
    incidentCell.textContent = status.title || '—';

    const checkedCell = document.createElement('td');
    checkedCell.className = 'table-checked';
    checkedCell.textContent = status.checkedAt ? formatRelativeTime(status.checkedAt) : 'Non vérifié';

    const actionCell = document.createElement('td');
    actionCell.className = 'table-actions';
    actionCell.append(
      createActionButton('↻', `Actualiser ${service.name}`, () => refreshOne(service.id)),
      createActionButton('✎', `Modifier ${service.name}`, () => openEditDialog(service)),
      createActionButton('×', `Supprimer ${service.name}`, () => deleteService(service))
    );

    row.append(serviceCell, statusCell, incidentCell, checkedCell, actionCell);
    elements.tableBody.appendChild(row);
  });
}
function resetDetection() {
  elements.detectionResult.classList.add('hidden');
  elements.detectionResult.classList.remove('error');
  elements.detectionResult.textContent = '';
  hideFormError();
}

function showFormError(message) {
  elements.formError.textContent = message;
  elements.formError.classList.remove('hidden');
}

function hideFormError() {
  elements.formError.classList.add('hidden');
  elements.formError.textContent = '';
}

function openCreateDialog() {
  currentlyEditing = null;
  elements.serviceDialogTitle.textContent = 'Ajouter un service';
  elements.serviceForm.reset();
  elements.serviceId.value = '';
  elements.enabled.checked = true;
  elements.advancedFields.open = false;
  resetDetection();
  elements.serviceDialog.showModal();
}

function openEditDialog(service) {
  currentlyEditing = service;
  elements.serviceDialogTitle.textContent = 'Modifier un service';
  elements.serviceId.value = service.id;
  elements.serviceName.value = service.name;
  elements.pageUrl.value = service.pageUrl;
  elements.provider.value = service.provider;
  elements.endpoint.value = service.endpoint;
  elements.method.value = service.method || 'GET';
  elements.enabled.checked = service.enabled !== false;
  elements.advancedFields.open = true;
  resetDetection();
  elements.serviceDialog.showModal();
}

async function detectService() {
  resetDetection();
  const pageUrl = elements.pageUrl.value.trim();
  if (!pageUrl) {
    showFormError('Indique d’abord l’URL publique de la page de statut.');
    return;
  }
  elements.detectBtn.disabled = true;
  elements.detectBtn.textContent = 'Détection…';
  try {
    const detection = await send('DETECT_SERVICE', { pageUrl });
    const { config, sample, detectionNote } = detection;
    elements.pageUrl.value = config.pageUrl;
    elements.provider.value = config.provider;
    elements.endpoint.value = config.endpoint;
    elements.method.value = config.method || 'GET';
    elements.advancedFields.open = true;
    const sampleLabel = STATUS_META[sample.level]?.label || sample.level;
    elements.detectionResult.textContent = `${detectionNote} détecté. État testé : ${sampleLabel}${sample.title ? ` — ${sample.title}` : ''}.`;
    elements.detectionResult.classList.remove('hidden');
  } catch (error) {
    elements.detectionResult.textContent = `Détection impossible : ${error.message} Vous pouvez compléter les champs avancés manuellement.`;
    elements.detectionResult.classList.add('error');
    elements.detectionResult.classList.remove('hidden');
    elements.advancedFields.open = true;
  } finally {
    elements.detectBtn.disabled = false;
    elements.detectBtn.textContent = 'Détecter';
  }
}

async function saveService(event) {
  event.preventDefault();
  hideFormError();
  if (!elements.provider.value || !elements.endpoint.value.trim()) {
    showFormError('Lance la détection ou complète le type et l’URL sondée manuellement.');
    elements.advancedFields.open = true;
    return;
  }
  const payload = {
    id: elements.serviceId.value || undefined,
    createdAt: currentlyEditing?.createdAt,
    name: elements.serviceName.value,
    pageUrl: elements.pageUrl.value,
    endpoint: elements.endpoint.value,
    provider: elements.provider.value,
    method: elements.method.value,
    enabled: elements.enabled.checked
  };
  try {
    state = await send('SAVE_SERVICE', { service: payload });
    elements.serviceDialog.close();
    render();
  } catch (error) {
    showFormError(error.message);
  }
}

async function deleteService(service) {
  if (!confirm(`Supprimer « ${service.name} » de la surveillance ?`)) return;
  state = await send('DELETE_SERVICE', { id: service.id });
  render();
}

async function refreshAll() {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.textContent = 'Actualisation…';
  try {
    state = await send('REFRESH_ALL');
    render();
  } finally {
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.textContent = 'Actualiser';
  }
}

async function refreshOne(id) {
  state = await send('REFRESH_ONE', { id });
  render();
}

function updateDensityAvailability() {
  const tableSelected = elements.viewMode.value === 'table';
  elements.cardDensity.disabled = tableSelected;
  elements.cardDensityField.classList.toggle('is-disabled', tableSelected);
}

function openSettings() {
  elements.refreshMinutes.value = String(state.settings.refreshMinutes || 5);
  elements.notificationsEnabled.checked = state.settings.notificationsEnabled !== false;
  const network = getNetworkSettings();
  elements.proxyFallbackEnabled.checked = network.proxyFallbackEnabled !== false;
  elements.corsProxyBase.value = network.corsProxyBase;
  elements.viewMode.value = state.settings.viewMode || 'table';
  elements.cardDensity.value = state.settings.cardDensity || 'compact';
  elements.sortMode.value = state.settings.sortMode || 'status';
  updateDensityAvailability();
  elements.settingsDialog.showModal();
}

async function saveSettings(event) {
  event.preventDefault();

  const requestedSettings = {
    refreshMinutes: Number(elements.refreshMinutes.value),
    notificationsEnabled: elements.notificationsEnabled.checked,
    viewMode: elements.viewMode.value,
    cardDensity: elements.cardDensity.value,
    sortMode: elements.sortMode.value,
    issuesOnly: state.settings.issuesOnly === true
  };

  state = await send('SAVE_SETTINGS', { settings: requestedSettings });

  saveNetworkSettings({
    proxyFallbackEnabled: elements.proxyFallbackEnabled.checked,
    corsProxyBase: elements.corsProxyBase.value
  });

  if (requestedSettings.notificationsEnabled && 'Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  elements.settingsDialog.close();
  render();
}

async function restoreDefaults() {
  if (!confirm('Remplacer toute votre liste actuelle par les services initiaux ?')) return;
  state = await send('RESTORE_DEFAULTS');
  elements.settingsDialog.close();
  render();
}

async function exportConfig() {
  const config = await send('EXPORT_CONFIG');
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `status-board-config-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importConfig(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!confirm('Importer cette configuration remplacera la liste actuelle. Continuer ?')) return;
    state = await send('IMPORT_CONFIG', { payload });
    render();
  } catch (error) {
    alert(`Import impossible : ${error.message}`);
  } finally {
    elements.importFile.value = '';
  }
}

elements.newServiceBtn.addEventListener('click', openCreateDialog);
elements.refreshBtn.addEventListener('click', refreshAll);
elements.searchInput.addEventListener('input', renderBoard);

async function persistIssuesOnlyPreference() {
  const issuesOnly = elements.issuesOnly.checked;
  state = await send('SAVE_SETTINGS', { settings: { ...state.settings, issuesOnly } });
  render();
}

elements.issuesOnly.addEventListener('change', () => {
  persistIssuesOnlyPreference().catch((error) => console.error('[issuesOnly]', error));
});
elements.detectBtn.addEventListener('click', detectService);
elements.serviceForm.addEventListener('submit', saveService);
elements.settingsBtn.addEventListener('click', openSettings);
elements.viewMode.addEventListener('change', updateDensityAvailability);
elements.settingsForm.addEventListener('submit', saveSettings);
elements.restoreDefaultsBtn.addEventListener('click', restoreDefaults);
elements.exportBtn.addEventListener('click', exportConfig);
elements.importBtn.addEventListener('click', () => elements.importFile.click());
elements.importFile.addEventListener('change', importConfig);
document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
});

window.addEventListener('statusboard:updated', () => loadState().catch(console.error));

setInterval(renderUpdatedAt, 1000);
initialiseWebApp()
  .then(() => loadState())
  .catch((error) => {
    elements.updatedAt.textContent = `Erreur au chargement : ${error.message}`;
  });
