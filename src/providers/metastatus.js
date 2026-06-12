function htmlToLines(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article|span|button|a|title)>/gi, '\n')
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

const META_CATEGORIES = [
  'ads',
  'business tools',
  'developer tools',
  'messaging',
  'business messaging',
  'monetization'
];

const GENERIC_LINE_PATTERNS = [
  /^meta(?: status)?$/i,
  /^status(?: and outages)?$/i,
  /^status and outages of meta business products$/i,
  /^meta\.?\s*home$/i,
  /^view(?: event)? history$/i,
  /^rss feed$/i,
  /^updated\b/i,
  /^all systems/i,
  /^current status$/i
];

function normaliseLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isCategoryLine(line) {
  const normalised = normaliseLine(line).toLowerCase();
  return META_CATEGORIES.includes(normalised);
}

function isGenericLine(line) {
  const value = normaliseLine(line);
  return !value || GENERIC_LINE_PATTERNS.some((pattern) => pattern.test(value));
}

function statusForLine(line) {
  for (const status of STATUS_PATTERNS) {
    const match = String(line || '').match(status.pattern);
    if (match) {
      return {
        level: status.level,
        phrase: status.level === 'ok' ? '' : normaliseStatusPhrase(match[0], status.level)
      };
    }
  }
  return null;
}

function normaliseStatusPhrase(value, level) {
  const phrase = normaliseLine(value)
    .replace(/\bhigh disruptions?\b/i, 'High disruptions')
    .replace(/\bmedium disruptions?\b/i, 'Medium disruptions')
    .replace(/\blow disruptions?\b/i, 'Low disruptions')
    .replace(/\bmajor disruptions?\b/i, 'Major disruptions')
    .replace(/\bminor disruptions?\b/i, 'Minor disruptions')
    .replace(/\bsome disruptions?\b/i, 'Some disruptions')
    .replace(/\bmajor outage\b/i, 'Major outage')
    .replace(/\bpartial outage\b/i, 'Partial outage')
    .replace(/\bdegraded\b/i, 'Degraded')
    .replace(/\bissues?\b/i, 'Issues')
    .replace(/\bdown\b/i, 'Down')
    .replace(/\bunavailable\b/i, 'Unavailable');

  if (phrase) return phrase;
  return level === 'major' ? 'High disruptions' : 'Disruptions';
}

function stripLeadingCategory(title) {
  let value = normaliseLine(title);
  const categories = [...META_CATEGORIES].sort((a, b) => b.length - a.length);

  for (const category of categories) {
    const pattern = new RegExp(`^${escapeRegExp(category)}\\s+`, 'i');
    if (pattern.test(value)) {
      value = value.replace(pattern, '').trim();
      break;
    }
  }

  return value;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleFromLine(line) {
  let title = normaliseLine(line)
    .replace(/\b(?:high\s+disruptions?|major\s+disruptions?|major\s+outage|outage|down|unavailable)\b/ig, '')
    .replace(/\b(?:medium\s+disruptions?|low\s+disruptions?|minor\s+disruptions?|some\s+disruptions?|degraded|partial\s+outage|issues?)\b/ig, '')
    .replace(/\b(?:the\s+service\s+is\s+up\s+and\s+running\s+with\s+no\s+known\s+issues|no\s+known\s+issues|up\s+and\s+running)\b/ig, '')
    .replace(/\b(?:status|updated|rss feed|view history|view event history)\b/ig, '')
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b\.?\s+\d{1,2}\s+\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:am|pm)?)?/ig, '')
    .replace(/[#:—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  title = stripLeadingCategory(title);

  if (isCategoryLine(title) || isGenericLine(title)) return '';
  if (title.length > 80) return title.slice(0, 77).trim() + '…';
  return title;
}

function previousProductTitle(lines, statusIndex) {
  for (let index = statusIndex - 1; index >= Math.max(0, statusIndex - 8); index -= 1) {
    const line = normaliseLine(lines[index]);
    if (!line || statusForLine(line) || isCategoryLine(line) || isGenericLine(line)) continue;

    const title = titleFromLine(line);
    if (title) return title;
  }

  return '';
}

function formatIssueTitle(title, phrase, level) {
  const safeTitle = normaliseLine(title);
  const safePhrase = normaliseLine(phrase);

  if (safeTitle && safePhrase) return `${safeTitle} — ${safePhrase}`;
  if (safeTitle) return safeTitle;
  if (safePhrase) return safePhrase;
  return level === 'major' ? 'High disruptions' : 'Disruptions';
}

function severityScore(level) {
  return { major: 3, minor: 2, ok: 1 }[level] || 0;
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
    .map((line, index) => {
      const status = statusForLine(line);
      if (!status) return null;

      const title = titleFromLine(line) || previousProductTitle(lines, index);
      return {
        level: status.level,
        title: status.level === 'ok' ? '' : formatIssueTitle(title, status.phrase, status.level)
      };
    })
    .filter(Boolean);

  const issue = candidates
    .filter((item) => item.level !== 'ok')
    .sort((a, b) => severityScore(b.level) - severityScore(a.level))[0];

  if (issue) return issue;

  if (candidates.some((item) => item.level === 'ok')) return { level: 'ok', title: '' };

  // La page d'accueil de Meta Status peut surtout lister des produits. Si aucun terme
  // d'incident n'est présent dans le HTML lu, on considère que le statut publié est OK.
  if (recognisesMetaStatus(html) && !/\b(?:disruptions?|outage|down|unavailable|degraded)\b/i.test(text)) {
    return { level: 'ok', title: '' };
  }

  return { level: 'error', title: 'État Meta Status non reconnu' };
}
