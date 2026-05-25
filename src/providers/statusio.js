export function recognisesStatusIo(html) {
  return /Powered\s+by\s+Status\.io|status\.io/i.test(html || '');
}

export function parseStatusIo(html) {
  if (/All\s+(?:services|systems)\s+(?:operating\s+normally|operational)/i.test(html)) {
    return { level: 'ok', title: '' };
  }

  const activeMatch = html.match(/(?:>|\s)(\d+)\s*(?:<[^>]+>\s*)*Active\s+Incidents/i);
  if (activeMatch && Number(activeMatch[1]) > 0) {
    return { level: 'minor', title: `${activeMatch[1]} incident(s) actif(s)` };
  }

  if (/Partial\s+(?:Service\s+)?Outage|Degraded\s+(?:Service|Performance)/i.test(html)) {
    return { level: 'minor', title: 'Service partiellement dégradé' };
  }

  if (/Major\s+(?:Service\s+)?Outage/i.test(html)) {
    return { level: 'major', title: 'Incident majeur' };
  }

  return { level: 'error', title: 'État Status.io non reconnu' };
}
