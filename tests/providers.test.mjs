import assert from 'node:assert/strict';
import { parseAtlassian } from '../src/providers/atlassian.js';
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
assert.equal(parseGoogle([{ end: '2026-05-20T10:00:00Z', most_recent_update: { status: 'AVAILABLE' } }]).level, 'ok');
assert.equal(parseGoogle([{ service_name: 'Gmail', severity: 'medium', most_recent_update: { status: 'SERVICE_DISRUPTION' } }]).level, 'minor');
assert.equal(parseIncidentIo({ summary: { ongoing_incidents: [], affected_components: [] } }).level, 'ok');
assert.equal(parsePulsetic({ data: { monitors: [], incidents: [{ status: 'identified', title: 'Incident actif' }] } }).level, 'minor');
assert.equal(parseSorryApp('<h2>All systems are go</h2>').level, 'ok');
assert.equal(parseStatusIo('<div>All services operating normally</div><div>0 Active Incidents</div>').level, 'ok');

console.log('Tests parsers : OK');
