import { isClosed, mapImpact, normalize } from '../utils.js';

export function recognisesAtlassian(data) {
  return Boolean(data?.status?.indicator && Array.isArray(data?.components));
}

export function parseAtlassian(data) {
  const pageLevel = mapImpact(data?.status?.indicator || 'none');
  const activeIncident = Array.isArray(data?.incidents)
    ? data.incidents.find((incident) => !isClosed(incident.status || incident.state))
    : null;

  if (activeIncident) {
    return {
      level: mapImpact(activeIncident.impact || activeIncident.severity || pageLevel),
      title: activeIncident.name || activeIncident.title || data?.status?.description || 'Incident en cours'
    };
  }

  const levels = { major: 3, minor: 2, maintenance: 1 };
  const problematic = Array.isArray(data?.components)
    ? data.components
        .map((component) => ({ component, level: mapImpact(component.status) }))
        .filter(({ component, level }) => normalize(component.status) !== 'operational' && level !== 'ok')
        .sort((a, b) => (levels[b.level] || 0) - (levels[a.level] || 0))[0]
    : null;

  if (pageLevel !== 'ok') {
    return {
      level: pageLevel,
      title: activeIncident?.name || problematic?.component?.name || data?.status?.description || 'Service dégradé'
    };
  }

  if (problematic) {
    return { level: problematic.level, title: problematic.component.name };
  }

  return { level: 'ok', title: '' };
}
