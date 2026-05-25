import assert from 'node:assert/strict';
import { detectStatusPage } from '../src/detector.js';

const nativeFetch = globalThis.fetch;
function response(body, { status = 200, url = '' } = {}) {
  const r = new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  Object.defineProperty(r, 'url', { value: url, configurable: true });
  return r;
}
function withRoutes(routes) {
  globalThis.fetch = async (url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`;
    const matched = routes[key] || routes[`GET ${url}`];
    return matched ? matched() : response('not found', { status: 404, url });
  };
}

withRoutes({
  'GET https://status.make.com/': () => response('<html>Make</html>', { url: 'https://status.make.com/' }),
  'GET https://status.make.com/api/v2/summary.json': () => response({ status: { indicator: 'none' }, components: [], incidents: [] }, { url: 'https://status.make.com/api/v2/summary.json' })
});
let detected = await detectStatusPage('https://status.make.com/');
assert.equal(detected.config.provider, 'atlassian');
assert.equal(detected.sample.level, 'ok');

withRoutes({
  'GET https://status.linear.app/': () => response('<html>Linear</html>', { url: 'https://linearstatus.com/' }),
  'GET https://linearstatus.com/api/v2/summary.json': () => response({ summary: { public_url: 'https://linearstatus.com', ongoing_incidents: [], affected_components: [] } }, { url: 'https://linearstatus.com/api/v2/summary.json' })
});
detected = await detectStatusPage('https://status.linear.app/');
assert.equal(detected.config.provider, 'incidentio');
assert.equal(detected.config.pageUrl, 'https://linearstatus.com/');

withRoutes({
  'GET https://status.gohighlevel.com/': () => response('<html>GHL</html>', { url: 'https://status.gohighlevel.com/' }),
  'POST https://api.pulsetic.com/public/status/status.gohighlevel.com': () => response({ data: { monitors: [{ name: 'App', status: 'online' }], incidents: [] } }, { url: 'https://api.pulsetic.com/public/status/status.gohighlevel.com' })
});
detected = await detectStatusPage('https://status.gohighlevel.com/');
assert.equal(detected.config.provider, 'pulsetic');
assert.equal(detected.config.method, 'POST');

withRoutes({
  'GET https://status.pipedrive.com/': () => response('<html><h2>All systems are go</h2><p>Powered by Sorry</p></html>', { url: 'https://status.pipedrive.com/' })
});
detected = await detectStatusPage('https://status.pipedrive.com/');
assert.equal(detected.config.provider, 'sorryapp');
assert.equal(detected.sample.level, 'ok');

withRoutes({
  'GET https://status.cloud.google.com/': () => response('<html>GCloud</html>', { url: 'https://status.cloud.google.com/' }),
  'GET https://status.cloud.google.com/incidents.json': () => response([{ end: '2026-05-20T00:00:00Z', most_recent_update: { status: 'AVAILABLE' } }], { url: 'https://status.cloud.google.com/incidents.json' })
});
detected = await detectStatusPage('https://status.cloud.google.com/');
assert.equal(detected.config.provider, 'google');
assert.equal(detected.sample.level, 'ok');

withRoutes({
  'GET https://status.shadow.tech/': () => response('<html><div>All services operating normally</div><div>0 Active Incidents</div><p>Powered by Status.io</p></html>', { url: 'https://status.shadow.tech/' })
});
detected = await detectStatusPage('https://status.shadow.tech/');
assert.equal(detected.config.provider, 'statusio-html');
assert.equal(detected.sample.level, 'ok');

globalThis.fetch = nativeFetch;
console.log('Tests auto-détection : OK');
