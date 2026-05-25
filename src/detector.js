import { fetchJson, fetchText, safeMessage } from './utils.js';
import {
  recognisesAtlassian,
  recognisesInstatus,
  recognisesIncidentIo,
  recognisesGoogle,
  recognisesPulsetic,
  recognisesSorryApp,
  recognisesStatusIo,
  parseAtlassian,
  parseInstatus,
  parseIncidentIo,
  parseGoogle,
  parsePulsetic,
  parseSorryApp,
  parseStatusIo
} from './providers/index.js';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function found(config, sample, detectionNote = '') {
  return { config, sample, detectionNote };
}

export async function detectStatusPage(inputUrl) {
  const entered = new URL(inputUrl);
  let canonicalPageUrl = entered.href;
  let html = '';
  const attempts = [];

  console.groupCollapsed(`[detect] ${inputUrl}`);
  try {
    try {
      const pageResponse = await fetchText(entered.href);
      html = pageResponse.text;
      canonicalPageUrl = pageResponse.finalUrl || entered.href;
      console.info('Page publique accessible :', canonicalPageUrl);
    } catch (error) {
      attempts.push(`Page HTML : ${safeMessage(error)}`);
      console.info('Page HTML non lisible, poursuite via API.', error);
    }

    const canonical = new URL(canonicalPageUrl);
    const origins = unique([entered.origin, canonical.origin]);
    const hosts = unique([entered.hostname, canonical.hostname]);

    /* Google expose un flux JSON historique : un incident est actif seulement sans date de fin. */
    if (hosts.includes('status.cloud.google.com')) {
      const endpoint = 'https://status.cloud.google.com/incidents.json';
      const { data } = await fetchJson(endpoint);
      if (recognisesGoogle(data)) return found(
        { pageUrl: canonicalPageUrl, endpoint, provider: 'google', method: 'GET' },
        parseGoogle(data),
        'Google Cloud Status JSON'
      );
    }
    if (canonical.pathname.includes('/appsstatus/dashboard') || entered.pathname.includes('/appsstatus/dashboard')) {
      const endpoint = 'https://www.google.com/appsstatus/dashboard/incidents.json';
      const { data } = await fetchJson(endpoint);
      if (recognisesGoogle(data)) return found(
        { pageUrl: canonicalPageUrl, endpoint, provider: 'google', method: 'GET' },
        parseGoogle(data),
        'Google Workspace Status JSON'
      );
    }

    /* JSON : on accepte une route seulement si sa structure correspond à un provider connu. */
    for (const origin of origins) {
      const candidates = [
        `${origin}/api/v2/summary.json`,
        `${origin}/summary.json`
      ];
      for (const endpoint of candidates) {
        console.info('Sonde JSON :', endpoint);
        try {
          const { data, finalUrl } = await fetchJson(endpoint);
          if (recognisesAtlassian(data)) return found(
            { pageUrl: canonicalPageUrl, endpoint: finalUrl || endpoint, provider: 'atlassian', method: 'GET' },
            parseAtlassian(data),
            'Atlassian Statuspage'
          );
          if (recognisesIncidentIo(data)) return found(
            { pageUrl: canonicalPageUrl, endpoint: finalUrl || endpoint, provider: 'incidentio', method: 'GET' },
            parseIncidentIo(data),
            'Incident.io'
          );
          if (recognisesInstatus(data)) return found(
            { pageUrl: canonicalPageUrl, endpoint: finalUrl || endpoint, provider: 'instatus', method: 'GET' },
            parseInstatus(data),
            'Instatus'
          );
          attempts.push(`${endpoint} : JSON non reconnu`);
        } catch (error) {
          attempts.push(`${endpoint} : ${safeMessage(error)}`);
        }
      }
    }

    /* Pulsetic requiert une requête POST vers son API publique. */
    for (const host of hosts) {
      const endpoint = `https://api.pulsetic.com/public/status/${host}`;
      console.info('Sonde Pulsetic POST :', endpoint);
      try {
        const { data } = await fetchJson(endpoint, { method: 'POST' });
        if (recognisesPulsetic(data)) return found(
          { pageUrl: canonicalPageUrl, endpoint, provider: 'pulsetic', method: 'POST' },
          parsePulsetic(data),
          'Pulsetic'
        );
        attempts.push(`${endpoint} : JSON Pulsetic non reconnu`);
      } catch (error) {
        attempts.push(`${endpoint} : ${safeMessage(error)}`);
      }
    }

    /* Certaines plateformes n'ont pas de flux public simple : lecture prudente du HTML. */
    if (html && recognisesSorryApp(html)) return found(
      { pageUrl: canonicalPageUrl, endpoint: canonicalPageUrl, provider: 'sorryapp', method: 'GET' },
      parseSorryApp(html),
      'SorryApp — lecture HTML'
    );
    if (html && recognisesStatusIo(html)) return found(
      { pageUrl: canonicalPageUrl, endpoint: canonicalPageUrl, provider: 'statusio-html', method: 'GET' },
      parseStatusIo(html),
      'Status.io — lecture HTML'
    );

    throw new Error(`Aucun format reconnu. Tentatives :\n${attempts.join('\n')}`);
  } finally {
    console.groupEnd();
  }
}
