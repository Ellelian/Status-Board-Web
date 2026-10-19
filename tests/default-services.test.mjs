import assert from 'node:assert/strict';
import { DEFAULT_SERVICES, PUBLIC_STATUS_PAGES } from '../src/defaults.js';
import { initialiseStorage, getServices } from '../src/storage.js';

const oldLocalStorage = globalThis.localStorage;
const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key)
};

const key = 'statusBoard.web.data';
const read = () => JSON.parse(memory.get(key));

try {
  // Fresh browsers get working native-CORS URLs and only one Cloudflare default.
  const calendlyDefault = DEFAULT_SERVICES.find(s => s.name === 'Calendly');
  const cloudflareDefaults = DEFAULT_SERVICES.filter(s => s.name === 'Cloudflare');
  assert.equal(cloudflareDefaults.length, 1);
  assert.deepEqual(
    { pageUrl: calendlyDefault.pageUrl, endpoint: calendlyDefault.endpoint },
    PUBLIC_STATUS_PAGES.calendly
  );
  assert.deepEqual(
    { pageUrl: cloudflareDefaults[0].pageUrl, endpoint: cloudflareDefaults[0].endpoint },
    PUBLIC_STATUS_PAGES.cloudflare
  );
  assert.equal(calendlyDefault.provider, 'atlassian');
  assert.equal(cloudflareDefaults[0].provider, 'atlassian');
  await initialiseStorage();
  let services = await getServices();
  assert.equal(services.length, DEFAULT_SERVICES.length);
  assert.equal(services.find(s => s.name === 'Calendly').endpoint, PUBLIC_STATUS_PAGES.calendly.endpoint);
  assert.equal(services.find(s => s.name === 'Cloudflare').endpoint, PUBLIC_STATUS_PAGES.cloudflare.endpoint);

  // Old browsers: migrate exactly the obsolete domain, preserve custom fields and IDs.
  const legacy = {
    services: [
      {
        id: 'calendly-existing', name: 'Calendly personnalisé', enabled: false,
        provider: 'atlassian', method: 'GET',
        pageUrl: 'https://www.calendlystatus.com/',
        endpoint: 'https://www.calendlystatus.com/api/v2/summary.json',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'cf-v2', name: 'Cloudflare v2', enabled: true,
        provider: 'atlassian', method: 'GET',
        pageUrl: 'https://new.cloudflarestatus.com',
        endpoint: 'https://new.cloudflarestatus.com/api/v2/summary.json',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'cf-already-good', name: 'Cloudflare', enabled: true,
        provider: 'atlassian', method: 'GET',
        ...PUBLIC_STATUS_PAGES.cloudflare,
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'custom', name: 'Custom status', enabled: true,
        provider: 'atlassian', method: 'GET',
        pageUrl: 'https://custom.example',
        endpoint: 'https://custom.example/api/v2/summary.json',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'custom-on-legacy-domain', name: 'Custom parser', enabled: true,
        provider: 'simple-html', method: 'GET',
        pageUrl: 'https://new.cloudflarestatus.com',
        endpoint: 'https://new.cloudflarestatus.com/',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'partial', name: 'Calendly already updated', enabled: true,
        provider: 'atlassian', method: 'GET',
        pageUrl: 'https://calendlystatus.com',
        endpoint: 'https://www.calendlystatus.com/api/v2/summary.json',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ],
    statuses: { 'calendly-existing': { level: 'error', title: 'HTTP 403' } },
    lastRefreshAt: '2026-10-19T16:00:00.000Z',
    settings: { refreshMinutes: 15 }
  };
  memory.set(key, JSON.stringify(legacy));

  await initialiseStorage();
  services = await getServices();
  assert.equal(services.length, legacy.services.length, 'No unwanted default duplicates on existing browsers');
  const get = id => services.find(s => s.id === id);
  assert.deepEqual(
    { pageUrl: get('calendly-existing').pageUrl, endpoint: get('calendly-existing').endpoint },
    PUBLIC_STATUS_PAGES.calendly
  );
  assert.deepEqual(
    { pageUrl: get('cf-v2').pageUrl, endpoint: get('cf-v2').endpoint },
    PUBLIC_STATUS_PAGES.cloudflare
  );
  assert.equal(get('calendly-existing').enabled, false);
  assert.equal(get('calendly-existing').name, 'Calendly personnalisé');
  assert.equal(get('custom').endpoint, 'https://custom.example/api/v2/summary.json');
  assert.equal(get('custom-on-legacy-domain').pageUrl, 'https://new.cloudflarestatus.com');
  assert.equal(get('partial').endpoint, PUBLIC_STATUS_PAGES.calendly.endpoint);
  assert.equal(get('cf-already-good').updatedAt, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(read().settings, legacy.settings);
  assert.deepEqual(read().statuses, legacy.statuses);
  assert.equal(read().lastRefreshAt, null, 'Force refresh after migrating old URLs');

  const afterMigration = read();
  await initialiseStorage();
  assert.deepEqual(read(), afterMigration, 'Migration is idempotent');

  // Restoring defaults should also use verified direct endpoints.
  await initialiseStorage({ forceDefaults: true });
  services = await getServices();
  assert.equal(services.length, DEFAULT_SERVICES.length);
  assert.equal(services.find(s => s.name === 'Calendly').pageUrl, PUBLIC_STATUS_PAGES.calendly.pageUrl);
  assert.equal(services.find(s => s.name === 'Cloudflare').pageUrl, PUBLIC_STATUS_PAGES.cloudflare.pageUrl);
  assert.equal(read().lastRefreshAt, null);
} finally {
  globalThis.localStorage = oldLocalStorage;
}

console.log('Tests URL par défaut et migration navigateur : OK');
