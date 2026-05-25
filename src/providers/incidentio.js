import { mapImpact } from '../utils.js';

export function recognisesIncidentIo(data) {
  const summary = data?.summary || data;
  return Boolean(
    summary &&
    (Array.isArray(summary.ongoing_incidents) || Array.isArray(summary.affected_components)) &&
    ('status_page_id' in summary || 'public_url' in summary || 'ongoing_incidents' in summary)
  );
}

export function parseIncidentIo(data) {
  const summary = data.summary || data;
  const incident = summary.ongoing_incidents?.[0];
  if (incident) {
    return {
      level: mapImpact(incident.severity || incident.impact || 'minor'),
      title: incident.name || incident.title || 'Incident en cours'
    };
  }
  const maintenance = summary.in_progress_maintenances?.[0];
  if (maintenance) {
    return { level: 'maintenance', title: maintenance.name || 'Maintenance en cours' };
  }
  const affected = summary.affected_components?.[0];
  if (affected) {
    return { level: 'minor', title: affected.component_name || affected.name || 'Composant affecté' };
  }
  return { level: 'ok', title: '' };
}
