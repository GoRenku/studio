import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardTiles } from './dashboard-tiles.mjs';
import { publishGrowthDashboard } from './publish-growth-dashboard.mjs';

const API_KEY = 'phx_personal_key_value';
const chartCount = dashboardTiles().filter(({ kind }) => kind === 'insight').length;
const headingCount = dashboardTiles().length - chartCount;

function harness({ argv = [], env = { POSTHOG_PERSONAL_API_KEY: API_KEY }, existingTiles, failQueryFor } = {}) {
  const requests = [];
  let tiles = existingTiles;
  let output = '';
  let errors = '';
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
  const fetch = async (url, init) => {
    const { pathname, search } = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ method: init.method, path: pathname + search, body });
    if (pathname === '/api/projects/@current/') { return reply({ id: 9, name: 'Renku Website' }); }
    if (pathname.endsWith('/query/')) {
      return body.query.query?.includes(failQueryFor) ? reply({ detail: 'Unknown column' }, 400) : reply({ results: [[1]] });
    }
    if (pathname === '/api/projects/9/dashboards/' && init.method === 'GET') {
      return reply({ results: tiles ? [{ id: 4, name: 'Renku growth' }] : [] });
    }
    if (pathname === '/api/projects/9/dashboards/' && init.method === 'POST') {
      tiles = [];
      return reply({ id: 4, name: 'Renku growth' });
    }
    if (pathname === '/api/projects/9/dashboards/4/' && init.method === 'GET') { return reply({ id: 4, tiles }); }
    if (pathname === '/api/projects/9/dashboards/4/') {
      for (const tile of (body.tiles ?? []).filter(({ id }) => !id)) { tiles.push({ id: tiles.length + 100, text: { id: 1, body: tile.text.body } }); }
      return reply({ id: 4 });
    }
    if (pathname === '/api/projects/9/insights/' && init.method === 'POST') {
      tiles.push({ id: tiles.length + 100, insight: { id: tiles.length + 500, name: body.name } });
      return reply({ id: 1 });
    }
    return reply({ id: 1 });
  };
  const io = { argv, env, fetch, stdout: { write: (text) => { output += text; } }, stderr: { write: (text) => { errors += text; } } };
  return { io, requests, output: () => output, errors: () => errors, tiles: () => tiles };
}

const writes = (requests) => requests.filter(({ method, path }) => method !== 'GET' && !path.endsWith('/query/'));

test('a check runs every chart query and changes nothing', async () => {
  const h = harness({ argv: ['--check'], existingTiles: [] });
  assert.equal(await publishGrowthDashboard(h.io), 0);
  assert.equal(h.requests.filter(({ path }) => path.endsWith('/query/')).length, chartCount);
  assert.deepEqual(writes(h.requests), []);
});

test('a failing chart query stops the run before any change', async () => {
  const h = harness({ failQueryFor: 'github_star_week' });
  assert.equal(await publishGrowthDashboard(h.io), 1);
  assert.match(h.errors(), /^\[growth-dashboard\] DASHBOARD004 2 chart queries failed/);
  assert.deepEqual(writes(h.requests), []);
});

test('the first publish creates the dashboard, every chart and heading, then lays them out', async () => {
  const h = harness();
  assert.equal(await publishGrowthDashboard(h.io), 0);
  assert.equal(h.requests.filter(({ method, path }) => method === 'POST' && path === '/api/projects/9/insights/').length, chartCount);
  assert.equal(h.tiles().filter(({ text }) => text).length, headingCount);
  const layout = writes(h.requests).at(-1);
  assert.equal(layout.body.tiles.length, chartCount + headingCount);
  assert.ok(layout.body.tiles.every(({ layouts }) => layouts.sm.w > 0));
  assert.match(h.output(), /Published "Renku growth" with \d+ tiles: https:\/\/eu\.posthog\.com\/project\/9\/dashboard\/4/);
});

test('a later publish updates charts and headings in place', async () => {
  const first = harness();
  await publishGrowthDashboard(first.io);
  const h = harness({ existingTiles: first.tiles() });
  assert.equal(await publishGrowthDashboard(h.io), 0);
  assert.equal(h.requests.filter(({ method, path }) => method === 'POST' && path.endsWith('/insights/')).length, 0);
  assert.equal(h.requests.filter(({ method, path }) => method === 'PATCH' && /\/insights\/\d+\/$/.test(path)).length, chartCount);
  assert.equal(h.tiles().length, chartCount + headingCount);
});

test('a missing key or an unknown argument is reported', async () => {
  const missing = harness({ env: {} });
  assert.equal(await publishGrowthDashboard(missing.io), 1);
  assert.match(missing.errors(), /DASHBOARD001/);
  const unknown = harness({ argv: ['--force'] });
  assert.equal(await publishGrowthDashboard(unknown.io), 1);
  assert.match(unknown.errors(), /DASHBOARD005/);
});

test('refused access names the key scopes without the key', async () => {
  const h = harness();
  h.io.fetch = async () => new Response(`bad key ${API_KEY}`, { status: 401 });
  assert.equal(await publishGrowthDashboard(h.io), 1);
  assert.match(h.errors(), /DASHBOARD002/);
  assert.doesNotMatch(h.errors(), new RegExp(API_KEY));
});
