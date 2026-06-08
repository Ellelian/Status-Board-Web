function plainText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function linesFromHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article)>/gi, '\n')
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

const STATUS_PATTERNS = [
  { level: 'major', pattern: /\b(?:major\s+(?:service\s+)?outage|critical|downtime|down|unavailable)\b/i },
  { level: 'minor', pattern: /\b(?:degraded\s+(?:performance|service)|partial\s+(?:outage|service\s+outage)|incident|warning)\b/i },
  { level: 'maintenance', pattern: /\b(?:under\s+maintenance|maintenance)\b/i }
];

function statusForLine(line) {
  for (const status of STATUS_PATTERNS) {
    if (status.pattern.test(line)) return status.level;
  }
  return null;
}

function titleFromLine(line) {
  const title = line
    .replace(/\b(?:major\s+(?:service\s+)?outage|critical|downtime|down|unavailable)\b/ig, '')
    .replace(/\b(?:degraded\s+(?:performance|service)|partial\s+(?:outage|service\s+outage)|incident|warning)\b/ig, '')
    .replace(/\b(?:under\s+maintenance|maintenance)\b/ig, '')
    .replace(/[\s:—–-]+$/g, '')
    .replace(/^[\s:—–-]+/g, '')
    .trim();

  return title || line.trim();
}

export function recognisesSimpleHtml(html) {
  const text = plainText(html);

  // Fallback volontairement prudent : on ne reconnaît ce provider que si la page
  // ressemble explicitement à une page de statut et contient des états lisibles.
  return /status\s+page|system\s+status|cluster\s+status/i.test(text)
    && /\b(?:operational|degraded\s+performance|partial\s+outage|major\s+outage|downtime|maintenance)\b/i.test(text);
}

export function parseSimpleHtml(html) {
  const lines = linesFromHtml(html);

  const affected = lines
    .map((line) => ({ line, level: statusForLine(line) }))
    .filter((item) => item.level);

  const major = affected.find((item) => item.level === 'major');
  if (major) return { level: 'major', title: titleFromLine(major.line) };

  const minor = affected.find((item) => item.level === 'minor');
  if (minor) return { level: 'minor', title: titleFromLine(minor.line) };

  const maintenance = affected.find((item) => item.level === 'maintenance');
  if (maintenance) return { level: 'maintenance', title: titleFromLine(maintenance.line) };

  if (/\boperational\b/i.test(lines.join(' '))) {
    return { level: 'ok', title: '' };
  }

  return { level: 'error', title: 'État HTML non reconnu' };
}
