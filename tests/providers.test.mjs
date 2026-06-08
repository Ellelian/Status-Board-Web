import assert from 'node:assert/strict';
import { parseAtlassian } from '../src/providers/atlassian.js';
import { parseSimpleHtml, recognisesSimpleHtml } from '../src/providers/simplehtml.js';
import { parseBetterStack } from '../src/providers/betterstack.js';
import { parseGoogle } from '../src/providers/google.js';
import { parseIncidentIo } from '../src/providers/incidentio.js';
import { parsePulsetic } from '../src/providers/pulsetic.js';
import { parseSorryApp } from '../src/providers/sorryapp.js';
import { parseStatusIo } from '../src/providers/statusio.js';

assert.deepEqual(
  parseAtlassian({ status: { indicator: 'none' }, components: [], incidents: [] }),
  { level: 'ok', title: '' }
);
assert.equal(
  parseAtlassian({ status: { indicator: 'minor' }, components: [], incidents: [{ status: 'investigating', impact: 'minor', name: 'Cloudflare Workers' }] }).level,
  'minor'
);

assert.deepEqual(
  parseAtlassian({
    status: { indicator: 'none' },
    components: [],
    incidents: [{ status: 'monitoring', impact: 'none', name: 'Connectivity issues from Pakistan region' }]
  }),
  { level: 'minor', title: 'Connectivity issues from Pakistan region' }
);
assert.deepEqual(
  parseAtlassian({
    status: { indicator: 'none' },
    components: [],
    incidents: [],
    scheduled_maintenances: [{ status: 'in_progress', name: 'Server IN-1257 maintenance' }]
  }),
  { level: 'maintenance', title: 'Server IN-1257 maintenance' }
);
assert.deepEqual(
  parseAtlassian({
    status: { indicator: 'none' },
    components: [],
    incidents: [],
    scheduled_maintenances: [{ status: 'scheduled', name: 'Maintenance future' }]
  }),
  { level: 'ok', title: '' }
);
assert.deepEqual(
  parseAtlassian({
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    incidents: [],
    scheduled_maintenances: [],
    components: [
      { id: 'infra', name: 'INFRASTRUCTURE', status: 'degraded_performance', group: true },
      { id: 'twilio', name: 'Twilio Group Rooms', status: 'degraded_performance', group: false, group_id: 'infra' }
    ]
  }),
  { level: 'minor', title: 'Twilio Group Rooms' }
);
assert.deepEqual(
  parseAtlassian({
    status: { indicator: 'major', description: 'Major outage' },
    incidents: [],
    scheduled_maintenances: [],
    components: [
      { id: 'infra', name: 'INFRASTRUCTURE', status: 'major_outage', group: true },
      { id: 'twilio', name: 'Twilio Group Rooms', status: 'degraded_performance', group: false, group_id: 'infra' }
    ]
  }),
  { level: 'major', title: 'INFRASTRUCTURE' }
);
assert.deepEqual(
  parseBetterStack({
    data: { type: 'status_page', attributes: { aggregate_state: 'operational' } },
    included: [
      { id: '1', type: 'status_page_resource', attributes: { public_name: 'App', status: 'operational' } }
    ]
  }),
  { level: 'ok', title: '' }
);
assert.deepEqual(
  parseBetterStack({
    data: { type: 'status_page', attributes: { aggregate_state: 'degraded' } },
    included: [
      { id: '1', type: 'status_page_resource', attributes: { public_name: 'App', status: 'degraded' } }
    ]
  }),
  { level: 'minor', title: 'App' }
);
assert.deepEqual(
  parseBetterStack({
    data: { type: 'status_page', attributes: { aggregate_state: 'downtime' } },
    included: [
      { id: '1', type: 'status_page_resource', attributes: { public_name: 'API', status: 'operational' } },
      {
        id: 'r1',
        type: 'status_report',
        attributes: {
          title: 'Database Connection Issues',
          report_type: 'manual',
          starts_at: '2020-01-01T10:00:00.000Z',
          ends_at: null,
          affected_resources: [{ status_page_resource_id: '1', status: 'downtime' }],
          aggregate_state: 'downtime'
        }
      }
    ]
  }),
  { level: 'major', title: 'Database Connection Issues' }
);
assert.deepEqual(
  parseBetterStack({
    data: { type: 'status_page', attributes: { aggregate_state: 'maintenance' } },
    included: [
      {
        id: 'r2',
        type: 'status_report',
        attributes: {
          title: 'Maintenance API',
          report_type: 'maintenance',
          starts_at: '2020-01-01T10:00:00.000Z',
          ends_at: null,
          affected_resources: [],
          aggregate_state: 'maintenance'
        }
      }
    ]
  }),
  { level: 'maintenance', title: 'Maintenance API' }
);
assert.equal(
  recognisesSimpleHtml(`
    <h1>Passcreator Status Page</h1>
    <h2>Passcreator Main Cluster Status</h2>
    <div>Frontend Application Operational</div>
    <div>API Operational</div>
  `),
  true
);
assert.deepEqual(
  parseSimpleHtml(`
    <h1>Passcreator Status Page</h1>
    <h2>Passcreator Main Cluster Status</h2>
    <div>Frontend Application Operational</div>
    <div>Asynchronous Processing Service Operational</div>
    <div>API Operational</div>
    <div>Pass Download Page Operational</div>
  `),
  { level: 'ok', title: '' }
);
assert.deepEqual(
  parseSimpleHtml(`
    <h1>Vendor Status Page</h1>
    <div>Frontend Application Operational</div>
    <div>API Degraded Performance</div>
  `),
  { level: 'minor', title: 'API' }
);
assert.deepEqual(
  parseSimpleHtml(`
    <h1>Vendor Status Page</h1>
    <div>API Operational</div>
    <div>Download Page Major Outage</div>
  `),
  { level: 'major', title: 'Download Page' }
);
assert.equal(parseGoogle([{ end: '2026-05-20T10:00:00Z', most_recent_update: { status: 'AVAILABLE' } }]).level, 'ok');
assert.equal(parseGoogle([{ service_name: 'Gmail', severity: 'medium', most_recent_update: { status: 'SERVICE_DISRUPTION' } }]).level, 'minor');
assert.equal(parseIncidentIo({ summary: { ongoing_incidents: [], affected_components: [] } }).level, 'ok');
assert.equal(parsePulsetic({ data: { monitors: [], incidents: [{ status: 'identified', title: 'Incident actif' }] } }).level, 'minor');
assert.equal(parseSorryApp('<h2>All systems are go</h2>').level, 'ok');
assert.equal(parseStatusIo('<div>All services operating normally</div><div>0 Active Incidents</div>').level, 'ok');

console.log('Tests parsers : OK');
