import { isClosed, mapImpact, normalize } from '../utils.js';

export function recognisesAtlassian(data) {
  return Boolean(data?.status?.indicator && Array.isArray(data?.components));
}

const LEVEL_SCORE = { major: 3, minor: 2, maintenance: 1, ok: 0 };

function activeIncidentStatus(incident) {
  if (!incident || isClosed(incident.status || incident.state)) return null;

  let level = mapImpact(incident.impact || incident.severity || 'none');

  // Statuspage peut laisser le statut global à "Operational" et l'impact à "none"
  // alors qu'un incident reste ouvert, par exemple en phase "Monitoring".
  // Pour le dashboard, un incident ouvert ne doit jamais apparaître en vert.
  if (level === 'ok') level = 'minor';

  return {
    level,
    title: incident.name || incident.title || 'Incident en cours'
  };
}

function activeMaintenanceStatus(maintenance) {
  const status = normalize(maintenance?.status || maintenance?.state);

  // Les maintenances seulement planifiées ne doivent pas déclencher d'alerte.
  // On retient celles effectivement en cours ou en vérification de fin.
  if (!['in_progress', 'verifying'].includes(status)) return null;

  return {
    level: 'maintenance',
    title: maintenance.name || maintenance.title || 'Maintenance en cours'
  };
}

export function parseAtlassian(data) {
  const pageLevel = mapImpact(data?.status?.indicator || 'none');

  const activeIncident = Array.isArray(data?.incidents)
    ? data.incidents
        .map(activeIncidentStatus)
        .filter(Boolean)
        .sort((a, b) => LEVEL_SCORE[b.level] - LEVEL_SCORE[a.level])[0]
    : null;

  // Un incident ouvert est plus utile à signaler qu'une maintenance simultanée.
  if (activeIncident) {
    return {
      level: activeIncident.level,
      title: activeIncident.title || data?.status?.description || 'Incident en cours'
    };
  }

  const maintenances = Array.isArray(data?.scheduled_maintenances)
    ? data.scheduled_maintenances
    : (Array.isArray(data?.scheduledMaintenances) ? data.scheduledMaintenances : []);

  const activeMaintenance = maintenances
    .map(activeMaintenanceStatus)
    .find(Boolean);

  if (activeMaintenance) return activeMaintenance;

  const problematic = Array.isArray(data?.components)
    ? data.components
        .map((component) => ({ component, level: mapImpact(component.status) }))
        .filter(({ component, level }) => normalize(component.status) !== 'operational' && level !== 'ok')
        .sort((a, b) => {
          const severityDifference = (LEVEL_SCORE[b.level] || 0) - (LEVEL_SCORE[a.level] || 0);
          if (severityDifference !== 0) return severityDifference;

          // À niveau identique, un composant concret est plus informatif qu'un groupe parent :
          // ex. "Twilio Group Rooms" plutôt que "INFRASTRUCTURE" chez WebinarJam.
          return Number(Boolean(a.component.group)) - Number(Boolean(b.component.group));
        })[0]
    : null;

  if (pageLevel !== 'ok') {
    return {
      level: pageLevel,
      title: problematic?.component?.name || data?.status?.description || 'Service dégradé'
    };
  }

  if (problematic) {
    return { level: problematic.level, title: problematic.component.name };
  }

  return { level: 'ok', title: '' };
}
