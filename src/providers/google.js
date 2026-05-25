export function recognisesGoogle(data) {
  return Array.isArray(data) && data.every((incident) => incident && typeof incident === 'object');
}

export function parseGoogle(data) {
  const active = data.find((incident) => {
    const latest = String(incident?.most_recent_update?.status || '').toUpperCase();
    return !incident.end && latest !== 'AVAILABLE';
  });
  if (!active) return { level: 'ok', title: '' };

  const severity = String(active.severity || '').toLowerCase();
  const level = severity === 'high' || severity === 'critical' ? 'major' : 'minor';
  return {
    level,
    title: active.service_name || active.affected_products?.[0]?.title || active.external_desc?.slice(0, 100) || 'Incident Google en cours'
  };
}
