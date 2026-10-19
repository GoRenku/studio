import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardTiles } from './dashboard-tiles.mjs';

const tiles = dashboardTiles();
const charts = tiles.filter(({ kind }) => kind === 'insight').map(({ chart }) => chart);

function sqlOf(chart) {
  return chart.query.source.query ?? '';
}

test('every chart has a unique name and a description', () => {
  assert.equal(new Set(charts.map(({ name }) => name)).size, charts.length);
  for (const chart of charts) {
    assert.ok(chart.description, chart.name);
  }
});

test('the dashboard opens with a heading and tiles never overlap or leave the grid', () => {
  assert.equal(tiles[0].kind, 'text');
  const cells = new Set();
  for (const { layout } of tiles) {
    assert.ok(layout.x >= 0 && layout.x + layout.w <= 12, JSON.stringify(layout));
    for (let x = layout.x; x < layout.x + layout.w; x += 1) {
      for (let y = layout.y; y < layout.y + layout.h; y += 1) {
        assert.ok(!cells.has(`${x},${y}`), `overlap at ${x},${y}`);
        cells.add(`${x},${y}`);
      }
    }
  }
});

test('growth report charts take the highest stored value per reading', () => {
  const growthCharts = charts.filter((chart) => /event = '(github_|download_requests_day)/.test(sqlOf(chart)) || /DOWNLOADS|download_requests_day/.test(sqlOf(chart)));
  assert.ok(growthCharts.length > 0);
  for (const chart of growthCharts) {
    assert.match(sqlOf(chart), /max\(toFloat\(|argMax\(toFloat\(/, chart.name);
  }
});

test('trends charts are limited to the live sites or to Studio usage statistics', () => {
  for (const chart of charts.filter(({ query }) => query.kind === 'InsightVizNode')) {
    assert.match(JSON.stringify(chart.query.source.properties), /gorenku\.com|latentmatinee\.com|"value":\["studio"\]/, chart.name);
  }
});

test('Studio SQL charts read only Studio usage statistics', () => {
  const studioSql = charts.filter((chart) => /'studio_started'|properties\.surface = 'studio'/.test(sqlOf(chart)));
  assert.ok(studioSql.length > 0);
  for (const chart of studioSql) {
    assert.match(sqlOf(chart), /properties\.surface = 'studio'/, chart.name);
  }
});
