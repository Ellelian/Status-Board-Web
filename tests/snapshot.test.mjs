import assert from 'node:assert/strict';
import { readStatusSnapshot, STATUS_SNAPSHOT_URL } from '../src/status-snapshot.js';
import { checkService } from '../src/status-engine.js';

const now = Date.now();
const checkedAt = new Date(now - 60_000).toISOString();
const target = { id: 'pipedrive', name: 'Pipedrive',
  pageUrl: 'https://status.pipedrive.com', endpoint: 'https://status.pipedrive.com',
  enabled: true, provider: 'sorryapp', method: 'GET'
};
const response = (json, status = 200) => new Response(JSON.stringify(json), { status });

const activeSnapshot = {
  version: 1,
  generatedAt: checkedAt,
  services: {
    'status.pipedrive.com': { level: 'minor', title: 'Web App Issue', checkedAt }
  }
};

assert.deepEqual(
  await readStatusSnapshot(target, async () => response(activeSnapshot), now),
  { level: 'minor', title: 'Web App Issue', checkedAt }
);
assert.equal(
  await readStatusSnapshot(target, async () => response({
    ...activeSnapshot, services: {
      'status.pipedrive.com': { level: 'ok', title: '', checkedAt: new Date(now - 21 * 60_000).toISOString() }
    }
  }), now),
  null,
  'Never show stale cached OK as current'
);
assert.equal(
  await readStatusSnapshot(target, async () => response({
    ...activeSnapshot, services: { 'status.pipedrive.com': {level: 'error', checkedAt} }
  }), now),
  null,
  'Never use cached errors as valid status'
);
assert.equal(
  await readStatusSnapshot({...target, pageUrl: 'https://unknown.example'}, async () => {throw new Error('not called')}, now),
  null,
  'Only explicitly allowlisted hosts may use the snapshot'
);
assert.equal(
  await readStatusSnapshot(target, async () => response(activeSnapshot, 404), now),
  null
);

const nativeFetch = globalThis.fetch;
try {
  // Network provider and the shared CORS proxy both return HTTP 403.
  // Browser falls back to the fresh, read-only server snapshot.
  globalThis.fetch = async (url) => {
    if (String(url).startsWith(STATUS_SNAPSHOT_URL)) {
      return response({version: 1, generatedAt: checkedAt, services: {
        'status.pipedrive.com': {level: 'ok', title: '', checkedAt}
      }});
    }
    return response({error:'Forbidden'}, 403);
  };
  const checked = await checkService(target);
  assert.equal(checked.level, 'ok');
  assert.equal(checked.checkedAt, checkedAt);

  // A stale snapshot does not hide HTTP 403 with a fabricated green result.
  globalThis.fetch = async (url) => {
    if (String(url).startsWith(STATUS_SNAPSHOT_URL)) {
      return response({version: 1, services: {
        'status.pipedrive.com': {level: 'ok', title:'', checkedAt:'2020-01-01T00:00:00Z'}
      }});
    }
    return response({error:'Forbidden'}, 403);
  };
  const failed = await checkService(target);
  assert.equal(failed.level, 'error');
} finally {
  globalThis.fetch = nativeFetch;
}

console.log('Tests status snapshot : OK');
