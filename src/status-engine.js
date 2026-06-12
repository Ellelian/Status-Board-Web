import { fetchJson, fetchText, safeMessage } from './utils.js';
import {
  parseAtlassian,
  parseBetterStack,
  parseInstatus,
  parseIncidentIo,
  parseGoogle,
  parseMetaStatus,
  parsePulsetic,
  parseSimpleHtml,
  parseSorryApp,
  parseStatusIo
} from './providers/index.js';

export const PROVIDER_NAMES = {
  atlassian: 'Atlassian Statuspage',
  betterstack: 'Better Stack',
  instatus: 'Instatus',
  incidentio: 'Incident.io',
  metastatus: 'Meta Status',
  pulsetic: 'Pulsetic',
  'simple-html': 'HTML simple',
  google: 'Google Status',
  sorryapp: 'SorryApp',
  'statusio-html': 'Status.io'
};

function metaStatusEndpoint(input) {
  try {
    const parsed = new URL(String(input || ''));
    if (parsed.hostname === 'metastatus.com') return 'https://metastatus.com/data/orgs.json';
  } catch {
    // On utilise l'endpoint public connu ci-dessous.
  }
  return 'https://metastatus.com/data/orgs.json';
}

export async function checkService(service) {
  const checkedAt = new Date().toISOString();
  if (!service.enabled) {
    return { serviceId: service.id, level: 'disabled', title: '', checkedAt };
  }

  try {
    let parsed;
    switch (service.provider) {
      case 'sorryapp': {
        const { text } = await fetchText(service.endpoint);
        parsed = parseSorryApp(text);
        break;
      }
      case 'statusio-html': {
        const { text } = await fetchText(service.endpoint);
        parsed = parseStatusIo(text);
        break;
      }
      case 'simple-html': {
        const { text } = await fetchText(service.endpoint);
        parsed = parseSimpleHtml(text);
        break;
      }
      case 'metastatus': {
        const { data } = await fetchJson(metaStatusEndpoint(service.endpoint));
        parsed = parseMetaStatus(data);
        break;
      }
      case 'pulsetic': {
        const { data } = await fetchJson(service.endpoint, { method: service.method || 'POST' });
        parsed = parsePulsetic(data);
        break;
      }
      case 'google': {
        const { data } = await fetchJson(service.endpoint);
        parsed = parseGoogle(data);
        break;
      }
      case 'incidentio': {
        const { data } = await fetchJson(service.endpoint, { method: service.method || 'GET' });
        parsed = parseIncidentIo(data);
        break;
      }
      case 'instatus': {
        const { data } = await fetchJson(service.endpoint, { method: service.method || 'GET' });
        parsed = parseInstatus(data);
        break;
      }
      case 'betterstack': {
        const { data } = await fetchJson(service.endpoint, { method: service.method || 'GET' });
        parsed = parseBetterStack(data);
        break;
      }
      case 'atlassian': {
        const { data } = await fetchJson(service.endpoint, { method: service.method || 'GET' });
        parsed = parseAtlassian(data);
        break;
      }
      default:
        throw new Error(`Type de page non pris en charge : ${service.provider || 'vide'}`);
    }

    return {
      serviceId: service.id,
      level: parsed.level,
      title: parsed.title || '',
      checkedAt
    };
  } catch (error) {
    console.error(`[status] ${service.name}`, error);
    return {
      serviceId: service.id,
      level: 'error',
      title: safeMessage(error),
      checkedAt
    };
  }
}
