import { mapImpact, normalize } from '../utils.js';

const LEVEL_SCORE = { major: 4, minor: 3, maintenance: 2, ok: 1 };

function mapBetterStackState(value) {
  const state = normalize(value);
  if (['downtime', 'down', 'major', 'outage'].includes(state)) return 'major';
  if (['degraded', 'partial_outage', 'partial', 'warning'].includes(state)) return 'minor';
  if (['maintenance', 'under_maintenance'].includes(state)) return 'maintenance';
  if (['operational', 'up', 'ok', 'none'].includes(state)) return 'ok';
  return mapImpact(state);
}

function isOngoingReport(report, now = Date.now()) {
  const attrs = report?.attributes || {};
  const startsAt = attrs.starts_at ? new Date(attrs.starts_at).getTime() : -Infinity;
  const endsAt = attrs.ends_at ? new Date(attrs.ends_at).getTime() : Infinity;

  if (!Number.isFinite(startsAt) && attrs.starts_at) return false;
  if (!Number.isFinite(endsAt) && attrs.ends_at) return false;

  return startsAt <= now && endsAt >= now;
}

function titleForAffectedResource(resourceId, resourcesById) {
  if (!resourceId) return '';
  return resourcesById.get(String(resourceId))?.attributes?.public_name || '';
}

function collectResources(data) {
  return Array.isArray(data?.included)
    ? data.included.filter((item) => item?.type === 'status_page_resource')
    : [];
}

function collectReports(data) {
  return Array.isArray(data?.included)
    ? data.included.filter((item) => item?.type === 'status_report')
    : [];
}

export function recognisesBetterStack(data) {
  return Boolean(
    data?.data?.type === 'status_page'
    && data.data.attributes
    && typeof data.data.attributes.aggregate_state === 'string'
  );
}

export function parseBetterStack(data) {
  const pageState = mapBetterStackState(data?.data?.attributes?.aggregate_state || 'operational');
  const resources = collectResources(data);
  const resourcesById = new Map(resources.map((resource) => [String(resource.id), resource]));
  const reports = collectReports(data);

  const activeReport = reports
    .filter((report) => isOngoingReport(report))
    .map((report) => {
      const attrs = report.attributes || {};
      const affected = Array.isArray(attrs.affected_resources) ? attrs.affected_resources : [];
      const affectedWorst = affected
        .map((item) => ({
          level: mapBetterStackState(item.status || attrs.aggregate_state),
          title: titleForAffectedResource(item.status_page_resource_id, resourcesById)
        }))
        .sort((a, b) => (LEVEL_SCORE[b.level] || 0) - (LEVEL_SCORE[a.level] || 0))[0];

      let level = mapBetterStackState(attrs.aggregate_state || affectedWorst?.level || pageState);
      if (normalize(attrs.report_type) === 'maintenance' && level === 'ok') level = 'maintenance';

      return {
        level,
        title: attrs.title || affectedWorst?.title || ''
      };
    })
    .filter((report) => report.level !== 'ok')
    .sort((a, b) => (LEVEL_SCORE[b.level] || 0) - (LEVEL_SCORE[a.level] || 0))[0];

  if (activeReport) {
    return {
      level: activeReport.level,
      title: activeReport.title || (activeReport.level === 'maintenance' ? 'Maintenance en cours' : 'Incident en cours')
    };
  }

  const problematicResource = resources
    .map((resource) => ({
      resource,
      level: mapBetterStackState(resource.attributes?.status || 'operational')
    }))
    .filter(({ level }) => level !== 'ok')
    .sort((a, b) => (LEVEL_SCORE[b.level] || 0) - (LEVEL_SCORE[a.level] || 0))[0];

  if (problematicResource) {
    return {
      level: problematicResource.level,
      title: problematicResource.resource.attributes?.public_name || ''
    };
  }

  if (pageState !== 'ok') {
    return {
      level: pageState,
      title: pageState === 'maintenance' ? 'Maintenance en cours' : 'Service dégradé'
    };
  }

  return { level: 'ok', title: '' };
}
