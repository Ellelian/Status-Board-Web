/**
 * GitHub Actions fallback when GitHub Pages is blocked by a provider's CORS/WAF.
 * Only public read-only status endpoints from this explicit allowlist are fetched.
 * Published snapshot is never treated as live data by the browser after its TTL.
 */
import { pathToFileURL } from 'node:url';
import { parseSorryApp, parseSorryAppJson, recognisesSorryAppJson } from '../src/providers/sorryapp.js';
import { parseAtlassian, recognisesAtlassian } from '../src/providers/atlassian.js';
import { parseSimpleHtml, recognisesSimpleHtml } from '../src/providers/simplehtml.js';

const SERVICES = Object.freeze({
  'status.pipedrive.com': { type: 'sorryapp', origin: 'https://status.pipedrive.com' },
  'www.calendlystatus.com': { type: 'atlassian', origin: 'https://www.calendlystatus.com' },
  'new.cloudflarestatus.com': { type: 'atlassian', origin: 'https://new.cloudflarestatus.com' },
  'status.passcreator.com': { type: 'html', origin: 'https://status.passcreator.com' }
});

async function getResponse(url, fetcher, accept) {
  const response = await fetcher(url, {
    headers: { Accept: accept, 'User-Agent': 'Status-Board-Web/status-snapshot (public statuses)' },
    signal: AbortSignal.timeout(14000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${url}`);
  return response;
}

export async function readService(config, fetcher = fetch) {
  if (config.type === 'sorryapp') {
    const url = `${config.origin}/api/v1/status`;
    const data = await (await getResponse(url, fetcher, 'application/json')).json();
    if (!recognisesSorryAppJson(data)) throw new Error('Unexpected SorryApp JSON');
    let notices = null;
    if (data.page.state !== 'operational') {
      try {
        notices = await (await getResponse(
          `${config.origin}/api/v1/notices?filter%5Btimeline_state_eq%5D=present`,
          fetcher, 'application/json'
        )).json();
      } catch (error) {
        console.warn('SorryApp notices unavailable (overall status preserved):', error.message);
      }
    }
    return parseSorryAppJson(data, notices);
  }

  if (config.type === 'atlassian') {
    const data = await (await getResponse(`${config.origin}/api/v2/summary.json`, fetcher, 'application/json')).json();
    if (!recognisesAtlassian(data)) throw new Error('Unexpected Statuspage JSON');
    return parseAtlassian(data);
  }

  if (config.type === 'html') {
    const html = await (await getResponse(config.origin, fetcher, 'text/html')).text();
    if (!recognisesSimpleHtml(html)) throw new Error('Unexpected status page HTML');
    return parseSimpleHtml(html);
  }

  throw new Error('Unsupported source type');
}

export async function collectSnapshot(fetcher = fetch) {
  const services = {};
  const checkedAt = new Date().toISOString();
  await Promise.all(Object.entries(SERVICES).map(async ([host, config]) => {
    try {
      const { level, title } = await readService(config, fetcher);
      if (!['ok', 'minor', 'major', 'maintenance'].includes(level)) {
        throw new Error(`Parser returned ${level}`);
      }
      services[host] = { level, title: title || '', checkedAt };
      console.log(`${host}: ${level} — ${title || 'no incident'}`);
    } catch (error) {
      // Never publish fabricated green statuses for endpoints that cannot be fetched.
      console.warn(`${host}: unavailable — ${error.message}`);
    }
  }));
  return { version: 1, generatedAt: checkedAt, services };
}

async function publish(snapshot) {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const branch = 'status-cache';
  const path = 'status-snapshot.json';
  if (!repo || !token) throw new Error('GITHUB_REPOSITORY / GITHUB_TOKEN required');
  const endpoint = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'Status-Board-Web/status-snapshot',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const existing = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15000) });
  const metadata = existing.ok ? await existing.json() : null;
  if (!existing.ok && existing.status !== 404) throw new Error(`GitHub read snapshot HTTP ${existing.status}`);

  // If no sources were refreshed, do not rewrite the file with a false heartbeat.
  if (!Object.keys(snapshot.services).length) {
    throw new Error('No source could be refreshed: snapshot not published');
  }

  // Keep the previous successful per-service value only with its original checkedAt.
  if (metadata?.content) {
    try {
      const prior = JSON.parse(Buffer.from(metadata.content.replace(/\s/g, ''), 'base64').toString('utf8'));
      for (const [host, result] of Object.entries(prior.services || {})) {
        if (!snapshot.services[host] && result?.checkedAt) snapshot.services[host] = result;
      }
    } catch (error) {
      console.warn('Previous cache could not be decoded:', error.message);
    }
  }

  const encoded = Buffer.from(JSON.stringify(snapshot, null, 2) + '\n', 'utf8').toString('base64');
  const body = {
    message: 'Refresh read-only public status snapshot',
    content: encoded,
    branch,
    ...(metadata?.sha ? { sha: metadata.sha } : {})
  };
  const target = `https://api.github.com/repos/${repo}/contents/${path}`;
  const result = await fetch(target, {
    method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  if (!result.ok) throw new Error(`GitHub publish snapshot HTTP ${result.status}: ${(await result.text()).slice(0, 250)}`);
  console.log(`Snapshot published to ${repo}/${branch}/${path}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const snapshot = await collectSnapshot();
  if (process.argv.includes('--publish')) await publish(snapshot);
  else console.log(JSON.stringify(snapshot, null, 2));
}
