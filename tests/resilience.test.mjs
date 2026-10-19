import assert from 'node:assert/strict';
import { fetchJson, fetchText, mapImpact, REQUEST_TIMEOUT_MS } from '../src/utils.js';
import { parseAtlassian } from '../src/providers/atlassian.js';
import { parseBetterStack } from '../src/providers/betterstack.js';
import { parseInstatus } from '../src/providers/instatus.js';
import { readStatusSnapshot } from '../src/status-snapshot.js';

// Les statuts déjà reconnus ne changent pas.
assert.equal(mapImpact('operational'), 'ok');
assert.equal(mapImpact('degraded_performance'), 'minor');
assert.equal(mapImpact('major_outage'), 'major');
assert.equal(mapImpact('under_maintenance'), 'maintenance');
assert.equal(mapImpact('unexpected'), 'minor'); // legacy default: active incidents remain conservative
assert.equal(mapImpact('unexpected', 'error'), 'error');

// État global ou composant inconnu : jamais un faux incident ni un faux vert.
const page = (indicator = 'none', components = [], incidents = [], scheduled_maintenances = []) =>
  ({ status: { indicator }, components, incidents, scheduled_maintenances });

assert.deepEqual(
  parseAtlassian(page('some_new_state')),
  { level: 'error', title: 'État Statuspage non reconnu' }
);
assert.deepEqual(
  parseAtlassian(page('none', [{ name: 'API', status: 'new_unrecognised_state' }])),
  { level: 'error', title: 'État d’un composant Statuspage non reconnu' }
);
assert.deepEqual(
  parseAtlassian(page('none', [], [{ status: 'monitoring', impact: 'none', name: 'Incident suivi' }])),
  { level: 'minor', title: 'Incident suivi' }
);
assert.deepEqual(
  parseAtlassian(page('none', [], [{ status: 'resolved', impact: 'major', name: 'Ancien incident' }])),
  { level: 'ok', title: '' }
);
assert.deepEqual(
  parseAtlassian(page('none', [], [], [{ status: 'scheduled', name: 'Maintenance future' }])),
  { level: 'ok', title: '' }
);
assert.deepEqual(
  parseAtlassian(page('none', [], [], [{ status: 'in_progress', name: 'Maintenance actuelle' }])),
  { level: 'maintenance', title: 'Maintenance actuelle' }
);
assert.deepEqual(
  parseAtlassian(page('unrecognised', [{ name: 'API', status: 'degraded_performance' }])),
  { level: 'minor', title: 'API' }
);

const better = (status, resources = [], reports = []) => ({
  data: { type: 'status_page', attributes: { aggregate_state: status } },
  included: [
    ...resources.map(({ name, status: resourceStatus }, i) => ({
      type: 'status_page_resource', id: String(i),
      attributes: { public_name: name, status: resourceStatus }
    })),
    ...reports
  ]
});
assert.deepEqual(
  parseBetterStack(better('unknown_state')),
  { level: 'error', title: 'État Better Stack non reconnu' }
);
assert.deepEqual(
  parseBetterStack(better('operational', [{ name: 'API', status: 'new_state' }])),
  { level: 'error', title: 'État d’une ressource Better Stack non reconnu' }
);
assert.deepEqual(
  parseBetterStack(better('degraded', [{ name: 'API', status: 'degraded' }])),
  { level: 'minor', title: 'API' }
);
assert.deepEqual(
  parseBetterStack(better('operational', [{ name: 'API', status: 'operational' }])),
  { level: 'ok', title: '' }
);

assert.deepEqual(
  parseInstatus({ page: { status: 'unknown_new_state' }, activeIncidents: [] }),
  { level: 'error', title: 'État Instatus non reconnu' }
);
assert.deepEqual(
  parseInstatus({ page: { status: 'operational' }, activeIncidents: [
    { status: 'resolved', name: 'Résolu', impact: 'major' }
  ] }),
  { level: 'ok', title: '' }
);
assert.deepEqual(
  parseInstatus({ page: { status: 'operational' }, activeIncidents: [
    { status: 'investigating', name: 'Incident actuel', impact: 'major' }
  ] }),
  { level: 'major', title: 'Incident actuel' }
);

// Une source silencieuse ne doit pas bloquer indéfiniment une actualisation.
assert.equal(REQUEST_TIMEOUT_MS, 8000);
const originalFetch = globalThis.fetch;
const endpoint = 'https://test.example/status.json';
const pauseUntilAbort = (options) => new Promise((_, reject) => {
  options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
});
try {
  const calls = [];
  globalThis.fetch = (url, options) => {
    calls.push(String(url));
    if (String(url).startsWith('https://corsproxy.io/?')) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }
    return pauseUntilAbort(options);
  };
  const result = await fetchJson(endpoint, { timeoutMs: 25 });
  assert.equal(result.usedProxy, true);
  assert.deepEqual(result.data, { ok: true });
  assert.equal(calls.length, 2, 'Direct timeout triggers the existing CORS fallback');

  let attempts = 0;
  globalThis.fetch = (url, options) => {
    attempts++;
    return pauseUntilAbort(options);
  };
  await assert.rejects(
    () => fetchJson(endpoint, { timeoutMs: 25 }),
    /Délai dépassé après 25 ms/
  );
  assert.equal(attempts, 2, 'Neither the direct attempt nor the proxy can hang indefinitely');

  let seenSignal = false;
  globalThis.fetch = async (url, options) => {
    seenSignal = options.signal instanceof AbortSignal;
    return new Response('<h2>All systems are go</h2>', { status: 200 });
  };
  const html = await fetchText('https://test.example/', { timeoutMs: 25 });
  assert.equal(html.text, '<h2>All systems are go</h2>');
  assert.equal(seenSignal, true);

  globalThis.fetch = async () => {
    throw new Error('This fetch should not be used');
  };
  await readStatusSnapshot(
    { pageUrl: 'https://status.pipedrive.com' },
    async (url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      assert.ok(url.includes('status-cache/status-snapshot.json'));
      return new Response(JSON.stringify({
        version: 1, services: {
          'status.pipedrive.com': {
            level: 'minor', title: 'Incident actif', checkedAt: new Date().toISOString()
          }
        }
      }));
    }
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Tests robustesse et délai réseau : OK');
