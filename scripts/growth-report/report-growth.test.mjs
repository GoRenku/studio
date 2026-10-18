import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reportGrowth } from './report-growth.mjs';

const gitHubReplies = JSON.parse(readFileSync(new URL('./fixtures/github-replies.json', import.meta.url), 'utf8'));
const downloadReply = JSON.parse(readFileSync(new URL('./fixtures/cloudflare-download-day.json', import.meta.url), 'utf8'));
const ENV = {
  GROWTH_GITHUB_TOKEN: 'github_pat_secret_value',
  CLOUDFLARE_ANALYTICS_TOKEN: 'cf_analytics_secret_value',
  CLOUDFLARE_ZONE_ID: 'zone-123',
  POSTHOG_PROJECT_TOKEN: 'phc_project_token_value',
};
const NOW = () => Date.parse('2026-10-18T09:17:00Z');

function gitHubBody(pathname) {
  const endpoint = pathname.replace(/^\/repos\/GoRenku\/[^/]+/, '');
  const bodies = {
    '': gitHubReplies.repository,
    '/stargazers/history': gitHubReplies.starHistoryPages[0],
    '/traffic/views': gitHubReplies.views,
    '/traffic/clones': gitHubReplies.clones,
    '/traffic/popular/referrers': gitHubReplies.referrers,
    '/traffic/popular/paths': gitHubReplies.paths,
  };
  return bodies[endpoint];
}

function harness({ argv = [], env = ENV, failGitHubFor, failCloudflareDay, notify } = {}) {
  const postHogBatches = [];
  const cloudflareDays = [];
  const output = { stdout: '', stderr: '' };
  const notifications = [];
  const fetch = async (url, init) => {
    const { host, pathname } = new URL(url);
    if (host === 'eu.i.posthog.com') {
      postHogBatches.push(JSON.parse(init.body));
      return new Response('{"status":"Ok"}');
    }
    if (host === 'api.cloudflare.com') {
      const { day } = JSON.parse(init.body).variables;
      cloudflareDays.push(day);
      return new Response(JSON.stringify(downloadReply), { status: day === failCloudflareDay ? 500 : 200 });
    }
    const status = failGitHubFor && pathname.startsWith(`/repos/${failGitHubFor}`) ? 500 : 200;
    return new Response(JSON.stringify(gitHubBody(pathname)), { status });
  };
  const io = {
    argv,
    env,
    fetch,
    now: NOW,
    stdout: { write: (text) => { output.stdout += text; } },
    stderr: { write: (text) => { output.stderr += text; } },
    notify: notify ?? ((code) => notifications.push(code)),
  };
  return { io, output, postHogBatches, cloudflareDays, notifications };
}

test('a live run sends one batch with GitHub and download events and prints a summary', async () => {
  const h = harness();
  assert.equal(await reportGrowth(h.io), 0);
  assert.equal(h.postHogBatches.length, 1);
  const names = new Set(h.postHogBatches[0].batch.map(({ event }) => event));
  assert.deepEqual([...names].sort(), [
    'download_requests_day', 'github_clones_day', 'github_repository_totals', 'github_star_week',
    'github_top_path', 'github_top_referrer', 'github_views_day',
  ]);
  assert.equal(h.cloudflareDays.length, 13);
  assert.equal(h.cloudflareDays[0], '2026-10-05');
  assert.equal(h.cloudflareDays.at(-1), '2026-10-17');
  assert.match(h.output.stdout, /^Sent \d+ events: 2 repositories, 13 download days, 26 other download requests skipped \(report date 2026-10-18\)\.\n$/);
  assert.equal(h.output.stderr, '');
});

test('a dry run prints one JSON line per event and sends nothing', async () => {
  const h = harness({ argv: ['--dry-run'], env: { ...ENV, POSTHOG_PROJECT_TOKEN: '' } });
  assert.equal(await reportGrowth(h.io), 0);
  assert.equal(h.postHogBatches.length, 0);
  const lines = h.output.stdout.trim().split('\n');
  assert.ok(lines.length > 0);
  assert.ok(lines.every((line) => JSON.parse(line).uuid));
  assert.doesNotMatch(h.output.stdout, /secret_value|phc_project/);
  assert.match(h.output.stderr, new RegExp(`^Dry run: built ${lines.length} events for 2 repositories`));
});

test('missing settings in a live run are reported together', async () => {
  const h = harness({ env: {} });
  assert.equal(await reportGrowth(h.io), 1);
  assert.match(h.output.stderr, /^\[growth-report\] GROWTH001 Missing required settings: GROWTH_GITHUB_TOKEN, CLOUDFLARE_ANALYTICS_TOKEN, CLOUDFLARE_ZONE_ID, POSTHOG_PROJECT_TOKEN\./);
  assert.match(h.output.stderr, /\nSuggestion: /);
});

test('unknown or conflicting arguments are rejected', async () => {
  for (const argv of [['--since=2026-10-01'], ['--dry-run', '--notify-on-failure']]) {
    const h = harness({ argv });
    assert.equal(await reportGrowth(h.io), 1);
    assert.match(h.output.stderr, /^\[growth-report\] GROWTH002 /);
  }
});

test('a GitHub failure on the second repository sends nothing', async () => {
  const h = harness({ failGitHubFor: 'GoRenku/studio-skills' });
  assert.equal(await reportGrowth(h.io), 1);
  assert.equal(h.postHogBatches.length, 0);
  assert.match(h.output.stderr, /^\[growth-report\] GROWTH004 .*GoRenku\/studio-skills/);
});

test('a Cloudflare failure on any day sends nothing', async () => {
  const h = harness({ failCloudflareDay: '2026-10-11' });
  assert.equal(await reportGrowth(h.io), 1);
  assert.equal(h.postHogBatches.length, 0);
  assert.match(h.output.stderr, /^\[growth-report\] GROWTH008 .*2026-10-11/);
});

test('scheduled failures show one notification with the code only', async () => {
  const h = harness({ argv: ['--notify-on-failure'], env: {} });
  assert.equal(await reportGrowth(h.io), 1);
  assert.deepEqual(h.notifications, ['GROWTH001']);
  const manual = harness({ env: {} });
  await reportGrowth(manual.io);
  assert.deepEqual(manual.notifications, []);
});

test('a failing notification keeps the original error and exit code', async () => {
  const h = harness({ argv: ['--notify-on-failure'], env: {}, notify: () => { throw new Error('osascript missing'); } });
  assert.equal(await reportGrowth(h.io), 1);
  assert.match(h.output.stderr, /^\[growth-report\] GROWTH001 /);
  assert.match(h.output.stderr, /Could not show the failure notification: osascript missing/);
});
