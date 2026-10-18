#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { DASHBOARD_DESCRIPTION, DASHBOARD_NAME, dashboardTiles } from './dashboard-tiles.mjs';
import { GrowthDashboardError } from './errors.mjs';
import { postHogApi } from './posthog-api.mjs';

const PROJECT_NAME = 'Renku Website';
const USAGE = 'node scripts/growth-dashboard/publish-growth-dashboard.mjs [--check]';

export async function publishGrowthDashboard(io) {
  try {
    const check = parseArguments(io.argv);
    const api = postHogApi({ apiKey: requireApiKey(io.env), fetch: io.fetch });
    const projectPath = await findProjectPath(api);
    const tiles = dashboardTiles();
    await checkChartQueries(api, projectPath, tiles, io.stdout);
    if (!check) {
      await publishTiles(api, projectPath, tiles, io.stdout);
    }
    return 0;
  } catch (error) {
    const suggestion = error instanceof GrowthDashboardError ? `\nSuggestion: ${error.suggestion}` : '';
    io.stderr.write(`[growth-dashboard] ${error instanceof Error ? error.message : String(error)}${suggestion}\n`);
    return 1;
  }
}

function parseArguments(argv) {
  if (argv.some((argument) => argument !== '--check')) {
    throw new GrowthDashboardError('DASHBOARD005', `Unsupported arguments: ${argv.join(' ')}.`, `Usage: ${USAGE}`);
  }
  return argv.includes('--check');
}

function requireApiKey(env) {
  if (!env.POSTHOG_PERSONAL_API_KEY) {
    throw new GrowthDashboardError('DASHBOARD001', 'POSTHOG_PERSONAL_API_KEY is not set.', 'Add a PostHog personal API key to the repository .env (see docs/operations/growth-report.md).');
  }
  return env.POSTHOG_PERSONAL_API_KEY;
}

async function findProjectPath(api) {
  // A key limited to one project can only read that project, through @current.
  const project = await api.get('/api/projects/@current/');
  if (project.name !== PROJECT_NAME) {
    throw new GrowthDashboardError('DASHBOARD006', `The key's project is "${project.name}", not "${PROJECT_NAME}".`, 'Limit the personal API key to the Renku Website project.');
  }
  return `/api/projects/${project.id}`;
}

// Runs every chart query first, so a broken chart stops the run before the
// dashboard changes.
async function checkChartQueries(api, projectPath, tiles, stdout) {
  const failures = [];
  for (const { chart } of tiles.filter(({ kind }) => kind === 'insight')) {
    try {
      const result = await api.post(`${projectPath}/query/`, { query: chart.query.source });
      stdout.write(`Checked "${chart.name}": ${result.results?.length ?? 0} rows.\n`);
    } catch (error) {
      failures.push(`"${chart.name}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length > 0) {
    throw new GrowthDashboardError('DASHBOARD004', `${failures.length} chart queries failed:\n${failures.join('\n')}`, 'Fix those chart definitions in scripts/growth-dashboard/ and run it again.');
  }
}

async function publishTiles(api, projectPath, tiles, stdout) {
  const dashboard = await findOrCreateDashboard(api, projectPath);
  const dashboardPath = `${projectPath}/dashboards/${dashboard.id}/`;
  const existing = (await api.get(dashboardPath)).tiles.filter((tile) => !tile.deleted);
  for (const tile of tiles) {
    await (tile.kind === 'insight'
      ? upsertInsight(api, projectPath, dashboard.id, tile.chart, existing)
      : upsertText(api, dashboardPath, tile, existing));
  }
  const current = (await api.get(dashboardPath)).tiles.filter((tile) => !tile.deleted);
  await api.patch(dashboardPath, { tiles: tilePositions(tiles, current) });
  const unknown = current.filter((tile) => !tiles.some((planned) => matchesTile(planned, tile)));
  const projectId = projectPath.split('/').at(-1);
  stdout.write(`Published "${DASHBOARD_NAME}" with ${tiles.length} tiles: https://eu.posthog.com/project/${projectId}/dashboard/${dashboard.id}\n`);
  if (unknown.length > 0) {
    stdout.write(`Left ${unknown.length} tiles that the script does not manage at the bottom of the dashboard.\n`);
  }
}

async function findOrCreateDashboard(api, projectPath) {
  const dashboards = await api.get(`${projectPath}/dashboards/?limit=200`);
  const found = dashboards.results.find(({ name, deleted }) => name === DASHBOARD_NAME && !deleted);
  if (found) {
    return api.patch(`${projectPath}/dashboards/${found.id}/`, { description: DASHBOARD_DESCRIPTION, pinned: true });
  }
  return api.post(`${projectPath}/dashboards/`, { name: DASHBOARD_NAME, description: DASHBOARD_DESCRIPTION, pinned: true });
}

async function upsertInsight(api, projectPath, dashboardId, chart, existing) {
  const insight = { name: chart.name, description: chart.description, query: chart.query };
  const tile = existing.find(({ insight: current }) => current?.name === chart.name);
  if (tile) {
    await api.patch(`${projectPath}/insights/${tile.insight.id}/`, insight);
    return;
  }
  await api.post(`${projectPath}/insights/`, { ...insight, dashboards: [dashboardId] });
}

async function upsertText(api, dashboardPath, tile, existing) {
  const current = existing.find((candidate) => headingOf(candidate) === tile.heading);
  const text = current ? { id: current.text.id, body: tile.body } : { body: tile.body };
  await api.patch(dashboardPath, { tiles: [current ? { id: current.id, text } : { text }] });
}

function tilePositions(tiles, current) {
  const bottom = Math.max(...tiles.map(({ layout }) => layout.y + layout.h));
  return current.map((tile, index) => {
    const planned = tiles.find((candidate) => matchesTile(candidate, tile));
    const layout = planned?.layout ?? { x: 0, y: bottom + index * 5, w: 6, h: 5 };
    return { id: tile.id, layouts: { sm: layout, xs: { x: 0, y: layout.y, w: 1, h: layout.h } } };
  });
}

function matchesTile(planned, tile) {
  return planned.kind === 'insight' ? tile.insight?.name === planned.chart.name : headingOf(tile) === planned.heading;
}

function headingOf(tile) {
  return tile.text?.body?.split('\n')[0];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await publishGrowthDashboard({
    argv: process.argv.slice(2),
    env: process.env,
    fetch: globalThis.fetch,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
