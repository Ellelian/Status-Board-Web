import { fetchJson, fetchText, safeMessage } from './utils.js';
import {
  parseAtlassian,
  parseInstatus,
  parseIncidentIo,
  parseGoogle,
  parsePulsetic,
  parseSorryApp,
  parseStatusIo
} from './providers/index.js';

export const PROVIDER_NAMES = {
  atlassian: 'Atlassian Statuspage',
  instatus: 'Instatus',
  incidentio: 'Incident.io',
  pulsetic: 'Pulsetic',
  google: 'Google Status',
  sorryapp: 'SorryApp',
  'statusio-html': 'Status.io'
};

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
