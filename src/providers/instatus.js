import { isClosed, mapImpact, normalize } from '../utils.js';

export function recognisesInstatus(data) {
  return Boolean(
    Array.isArray(data?.activeIncidents) ||
    Array.isArray(data?.activeMaintenances) ||
    data?.page?.status ||
    data?.status?.indicator
  );
}

export function parseInstatus(data) {
  const incidents = data.activeIncidents || data.incidents || [];
  const incident = incidents.find((item) => !isClosed(item.status || item.state));
  if (incident) {
    return {
      level: mapImpact(incident.impact || incident.severity || 'minor'),
      title: incident.name || incident.title || 'Incident en cours'
    };
  }

  const maintenance = (data.activeMaintenances || data.maintenances || [])
    .find((item) => !isClosed(item.status || item.state));
  if (maintenance) {
    return { level: 'maintenance', title: maintenance.name || maintenance.title || 'Maintenance en cours' };
  }

  const rawStatus = data?.status?.indicator || data?.page?.status || data?.status || 'operational';
  const level = mapImpact(rawStatus);
  return {
    level,
    title: level === 'ok' ? '' : (data?.status?.description || normalize(rawStatus))
  };
}
