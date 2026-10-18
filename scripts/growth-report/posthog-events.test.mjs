import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGrowthEvents } from './posthog-events.mjs';

const REPORT_DATE = '2026-10-18';
const COMMON = { report_date: REPORT_DATE, $process_person_profile: false, $geoip_disable: true };

const studio = {
  repository: 'GoRenku/studio',
  starsTotal: 7,
  starWeeks: [
    { week: 1791676800, newStars: 3 },
    { week: 1790467200, newStars: 3 },
    { week: 1791072000, newStars: 1 },
  ],
  views: { count: 30, uniques: 12, days: [{ day: '2026-10-17', count: 9, uniques: 4 }, { day: '2026-10-18', count: 1, uniques: 1 }] },
  clones: { count: 40, uniques: 15, days: [{ day: '2026-10-17', count: 11, uniques: 5 }] },
  referrers: [{ referrer: 'github.com', count: 6, uniques: 3 }],
  paths: [{ path: '/GoRenku/studio', title: 'Overview', count: 20, uniques: 8 }],
};

const downloadDays = [
  { day: '2026-10-17', requests: [
    { path: '/install.sh', country: 'DE', count: 12 },
    { path: '/studio/releases/0.1.26/darwin-arm64/renku-0.1.26-darwin-arm64.tar.gz', country: 'US', count: 2 },
    { path: '/wp-login.php', country: 'NL', count: 5 },
  ] },
  { day: '2026-10-18', requests: [{ path: '/install.sh', country: 'DE', count: 1 }] },
];

const readings = { repositories: [studio], downloadDays, reportDate: REPORT_DATE };

function eventsNamed(events, name) {
  return events.filter(({ event }) => event === name);
}

test('repository totals carry the star total and GitHub 14-day numbers', () => {
  const [totals] = eventsNamed(buildGrowthEvents(readings).events, 'github_repository_totals');
  assert.equal(totals.distinct_id, 'github:GoRenku/studio');
  assert.equal(totals.timestamp, '2026-10-18T00:00:00.000Z');
  assert.deepEqual(totals.properties, {
    repository: 'GoRenku/studio',
    stars_total: 7,
    views_14d: 30,
    unique_visitors_14d: 12,
    clones_14d: 40,
    unique_cloners_14d: 15,
    ...COMMON,
  });
});

test('star weeks add up from the oldest week whatever order pages arrive in', () => {
  const weeks = eventsNamed(buildGrowthEvents(readings).events, 'github_star_week');
  assert.deepEqual(weeks.map(({ properties }) => [properties.week_start, properties.new_stars, properties.stars_at_week_end]), [
    ['2026-09-27', 3, 3],
    ['2026-10-04', 1, 4],
    ['2026-10-11', 3, 7],
  ]);
  assert.equal(weeks[0].timestamp, new Date(1790467200 * 1000).toISOString());
});

test('views and clones are sent for finished days only', () => {
  const { events } = buildGrowthEvents(readings);
  const [views] = eventsNamed(events, 'github_views_day');
  assert.equal(eventsNamed(events, 'github_views_day').length, 1);
  assert.deepEqual(views.properties, { repository: 'GoRenku/studio', day: '2026-10-17', views: 9, unique_visitors: 4, ...COMMON });
  const [clones] = eventsNamed(events, 'github_clones_day');
  assert.deepEqual(clones.properties, { repository: 'GoRenku/studio', day: '2026-10-17', clones: 11, unique_cloners: 5, ...COMMON });
  assert.equal(clones.timestamp, '2026-10-17T00:00:00.000Z');
});

test('top referrers and paths keep GitHub text as given', () => {
  const { events } = buildGrowthEvents(readings);
  assert.deepEqual(eventsNamed(events, 'github_top_referrer')[0].properties, {
    repository: 'GoRenku/studio', referrer: 'github.com', views_14d: 6, unique_visitors_14d: 3, ...COMMON,
  });
  assert.deepEqual(eventsNamed(events, 'github_top_path')[0].properties, {
    repository: 'GoRenku/studio', path: '/GoRenku/studio', title: 'Overview', views_14d: 20, unique_visitors_14d: 8, ...COMMON,
  });
});

test('downloads are sent per finished day, published path and country', () => {
  const { events, skippedDownloadRequests } = buildGrowthEvents(readings);
  const downloads = eventsNamed(events, 'download_requests_day');
  assert.equal(downloads.length, 2);
  assert.equal(skippedDownloadRequests, 5);
  assert.equal(downloads[0].distinct_id, 'downloads:downloads.gorenku.com');
  assert.equal(downloads[0].timestamp, '2026-10-17T00:00:00.000Z');
  assert.deepEqual(downloads[0].properties, {
    day: '2026-10-17', path: '/install.sh', download_kind: 'installer_macos', country: 'DE', requests: 12, ...COMMON,
  });
  assert.deepEqual(downloads[1].properties, {
    day: '2026-10-17',
    path: '/studio/releases/0.1.26/darwin-arm64/renku-0.1.26-darwin-arm64.tar.gz',
    download_kind: 'release_archive',
    release_version: '0.1.26',
    release_target: 'darwin-arm64',
    country: 'US',
    requests: 2,
    ...COMMON,
  });
});

test('building twice gives identical ids and timestamps, all unique', () => {
  const first = buildGrowthEvents(readings).events;
  const second = buildGrowthEvents(readings).events;
  assert.deepEqual(first.map(({ uuid, timestamp }) => [uuid, timestamp]), second.map(({ uuid, timestamp }) => [uuid, timestamp]));
  assert.equal(new Set(first.map(({ uuid }) => uuid)).size, first.length);
});
