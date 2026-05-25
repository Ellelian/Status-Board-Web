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
