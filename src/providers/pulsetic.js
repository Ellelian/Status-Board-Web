export function recognisesPulsetic(raw) {
  const page = unwrap(raw);
  return Array.isArray(page?.monitors) && Array.isArray(page?.incidents);
}

function unwrap(raw) {
  return (Array.isArray(raw) ? raw[0]?.data : raw)?.data ?? raw?.data ?? raw;
}

export function parsePulsetic(raw) {
  const page = unwrap(raw);
  const offline = page.monitors?.find((monitor) => monitor.status === 'offline');
  if (offline) return { level: 'major', title: offline.name || 'Moniteur indisponible' };

  const degraded = page.monitors?.find((monitor) => monitor.status !== 'online');
  if (degraded) return { level: 'minor', title: degraded.name || 'Moniteur dégradé' };

  const openIncident = page.incidents?.find((incident) => incident.status !== 'resolved');
  if (openIncident) return { level: 'minor', title: openIncident.title || 'Incident en cours' };

  return { level: 'ok', title: '' };
}
