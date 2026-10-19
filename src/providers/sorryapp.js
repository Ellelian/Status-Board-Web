export function recognisesSorryApp(html) {
  return /Powered\s+by\s+Sorry|sorryapp|notice--open|All\s+systems\s+are\s+go/i.test(html || '');
}

export function parseSorryApp(html) {
  if (/All[\s\u00a0]+systems[\s\u00a0]+(?:are[\s\u00a0]+)?(?:go|operational)/i.test(html)) {
    return { level: 'ok', title: '' };
  }

  const openNotice = html.match(/<section[^>]*\bnotice--open\b[^>]*>([\s\S]*?)<\/section>/i);
  if (openNotice) {
    const title = openNotice[1].match(/<h3[^>]*\bnotice__title\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]
      ?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'Incident en cours';
    const level = /notice__state--(?:critical|major)/i.test(openNotice[1]) ? 'major' : 'minor';
    return { level, title };
  }

  // On n’interprète pas les incidents passés comme actifs.
  return { level: 'error', title: 'État SorryApp non reconnu' };
}

/**
 * SorryApp's public read-only Status API. The HTML parser above stays intact as fallback.
 * See https://sorryapp.sorryapp.com/api
 */
export function recognisesSorryAppJson(data) {
  const state = String(data?.page?.state || '').toLowerCase();
  return ['operational', 'degraded', 'under_maintenance', 'under-maintenance'].includes(state);
}

export function parseSorryAppJson(data, noticesResponse = null) {
  if (!recognisesSorryAppJson(data)) {
    return { level: 'error', title: 'État SorryApp JSON non reconnu' };
  }

  const state = data.page.state.toLowerCase();
  if (state === 'operational') return { level: 'ok', title: '' };

  const maintenance = state === 'under_maintenance' || state === 'under-maintenance';
  const level = maintenance ? 'maintenance' : 'minor';
  const notices = Array.isArray(noticesResponse?.notices) ? noticesResponse.notices : [];

  const active = notices.filter((notice) => {
    if (!notice || notice.timeline_state !== 'present' || notice.ended_at) return false;
    const type = String(notice.type || '').toLowerCase();
    const state = String(notice.state || '').toLowerCase();
    return maintenance
      ? type === 'planned' && state === 'underway'
      : type === 'unplanned' && ['investigating', 'identified'].includes(state);
  });

  const titles = [...new Set(active.map((notice) => String(notice.subject || '').trim()).filter(Boolean))];
  const title = titles.length
    ? titles.slice(0, 2).join(' · ') + (titles.length > 2 ? ` (+${titles.length - 2} autres)` : '')
    : (maintenance ? 'Maintenance en cours' : 'Incident en cours');

  return { level, title };
}
