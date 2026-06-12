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
  'GET https://status.gohighlevel.com/': () => response('<html>GHL — Powered by Better Stack</html>', { url: 'https://status.gohighlevel.com/' }),
  'GET https://status.gohighlevel.com/index.json': () => response({
    data: { type: 'status_page', attributes: { aggregate_state: 'operational' } },
    included: []
  }, { url: 'https://status.gohighlevel.com/index.json' })
});
detected = await detectStatusPage('https://status.gohighlevel.com/');
assert.equal(detected.config.provider, 'betterstack');
assert.equal(detected.config.endpoint, 'https://status.gohighlevel.com/index.json');
assert.equal(detected.config.method, 'GET');

withRoutes({
  'GET https://status.pipedrive.com/': () => response('<html><h2>All systems are go</h2><p>Powered by Sorry</p></html>', { url: 'https://status.pipedrive.com/' })
});
detected = await detectStatusPage('https://status.pipedrive.com/');
assert.equal(detected.config.provider, 'sorryapp');
assert.equal(detected.sample.level, 'ok');

withRoutes({
  'GET https://status.passcreator.com/': () => response(`
    <html>
      <body>
        <h1>Passcreator Status Page</h1>
        <h2>Passcreator Main Cluster Status</h2>
        <div>Frontend Application Operational</div>
        <div>API Operational</div>
      </body>
    </html>
  `, { url: 'https://status.passcreator.com/' }),
  'GET https://status.passcreator.com/api/v2/summary.json': () => response('Not found', { status: 404, url: 'https://status.passcreator.com/api/v2/summary.json' }),
  'GET https://status.passcreator.com/summary.json': () => response('Not found', { status: 404, url: 'https://status.passcreator.com/summary.json' }),
  'GET https://status.passcreator.com/index.json': () => response('Not found', { status: 404, url: 'https://status.passcreator.com/index.json' }),
  'POST https://api.pulsetic.com/public/status/status.passcreator.com': () => response('Not found', { status: 404, url: 'https://api.pulsetic.com/public/status/status.passcreator.com' })
});
detected = await detectStatusPage('https://status.passcreator.com/');
assert.equal(detected.config.provider, 'simple-html');
assert.equal(detected.config.endpoint, 'https://status.passcreator.com/');
assert.equal(detected.sample.level, 'ok');

withRoutes({
  'GET https://metastatus.com/': () => response(`
    <html>
      <head><title>Status and outages of Meta business products</title></head>
      <body>
        <h1>Meta Status</h1>
        <div>Facebook Login No known issues</div>
        <div>Graph API No known issues</div>
      </body>
    </html>
  `, { url: 'https://metastatus.com/' })
});
detected = await detectStatusPage('https://metastatus.com/');
assert.equal(detected.config.provider, 'metastatus');
assert.equal(detected.config.endpoint, 'https://metastatus.com/');
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
