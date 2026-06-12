function htmlToLines(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article|span)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function plainText(html) {
  return htmlToLines(html).join(' ');
}

const STATUS_PATTERNS = [
  // Important : "no known issues" contient le mot "issues".
  // On reconnaît donc d'abord l'état OK avant les signaux d'incident.
  { level: 'ok', pattern: /\b(?:the\s+service\s+is\s+up\s+and\s+running\s+with\s+no\s+known\s+issues|no\s+known\s+issues|up\s+and\s+running)\b/i },
  { level: 'major', pattern: /\b(?:high\s+disruptions?|major\s+disruptions?|major\s+outage|outage|down|unavailable)\b/i },
  { level: 'minor', pattern: /\b(?:medium\s+disruptions?|low\s+disruptions?|minor\s+disruptions?|some\s+disruptions?|degraded|partial\s+outage|issues?)\b/i }
];

function statusForLine(line) {
  for (const status of STATUS_PATTERNS) {
    if (status.pattern.test(line)) return status.level;
  }
  return null;
}

function titleFromLine(line, level) {
  let title = String(line || '')
    .replace(/\b(?:high\s+disruptions?|major\s+disruptions?|major\s+outage|outage|down|unavailable)\b/ig, '')
    .replace(/\b(?:medium\s+disruptions?|low\s+disruptions?|minor\s+disruptions?|some\s+disruptions?|degraded|partial\s+outage|issues?)\b/ig, '')
    .replace(/\b(?:the\s+service\s+is\s+up\s+and\s+running\s+with\s+no\s+known\s+issues|no\s+known\s+issues|up\s+and\s+running)\b/ig, '')
    .replace(/\b(?:status|updated|rss feed|view history|view event history)\b/ig, '')
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b\.?\s+\d{1,2}\s+\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:am|pm)?)?/ig, '')
    .replace(/[#:—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title || title.length < 2) {
    return level === 'major' ? 'High disruptions' : 'Disruptions';
  }

  // Sur les pages produit Meta, le titre peut être toute une phrase.
  // On garde une version courte si la phrase est trop longue.
  if (title.length > 80) return title.slice(0, 77).trim() + '…';
  return title;
}

export function recognisesMetaStatus(html) {
  const text = plainText(html);
  return /metastatus\.com|Meta'?s?\s+status|Status\s+and\s+outages\s+of\s+Meta\s+business\s+products|Meta\s+Business\s+Status|Meta\.?\s+Home/i.test(text)
    || /Facebook\s+Login\s+Status|Graph\s+API\s+Status|Marketing\s+API\s+Status|WhatsApp\s+Business\s+Platform\s+Status|Facebook\s+Ads\s+Manager\s+Status/i.test(text);
}

export function parseMetaStatus(html) {
  const lines = htmlToLines(html);
  const text = lines.join(' ');

  const candidates = lines
    .map((line) => ({ line, level: statusForLine(line) }))
    .filter((item) => item.level);

  const major = candidates.find((item) => item.level === 'major');
  if (major) return { level: 'major', title: titleFromLine(major.line, 'major') };

  const minor = candidates.find((item) => item.level === 'minor');
  if (minor) return { level: 'minor', title: titleFromLine(minor.line, 'minor') };

  if (candidates.some((item) => item.level === 'ok')) return { level: 'ok', title: '' };

  // La page d'accueil de Meta Status peut surtout lister des produits. Si aucun terme
  // d'incident n'est présent dans le HTML lu, on considère que le statut publié est OK.
  if (recognisesMetaStatus(html) && !/\b(?:disruptions?|outage|down|unavailable|degraded)\b/i.test(text)) {
    return { level: 'ok', title: '' };
  }

  return { level: 'error', title: 'État Meta Status non reconnu' };
}
