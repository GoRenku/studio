#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { readDownloadDay } from './cloudflare-downloads.mjs';
import { GrowthReportError } from './errors.mjs';
import { showFailureNotification } from './failure-notification.mjs';
import { readRepositoryGrowth } from './github-api.mjs';
import { sendPostHogBatch } from './posthog-capture.mjs';
import { buildGrowthEvents } from './posthog-events.mjs';

const REPOSITORIES = ['GoRenku/studio', 'GoRenku/studio-skills'];
// GitHub keeps 14 days of traffic, including today's partial day.
const WINDOW_DAYS = 13;
const DAY_MS = 24 * 60 * 60 * 1000;
const ARGUMENTS = { '--dry-run': 'dryRun', '--notify-on-failure': 'notifyOnFailure' };
const USAGE = 'node scripts/growth-report/report-growth.mjs [--dry-run | --notify-on-failure]';

export async function reportGrowth(io) {
  let options = {};
  try {
    options = parseArguments(io.argv);
    await runReport(options, io);
    return 0;
  } catch (error) {
    reportFailure(error, options, io);
    return 1;
  }
}

function parseArguments(argv) {
  const unknown = argv.filter((argument) => !ARGUMENTS[argument]);
  const options = Object.fromEntries(argv.filter((argument) => ARGUMENTS[argument]).map((argument) => [ARGUMENTS[argument], true]));
  if (unknown.length > 0 || (options.dryRun && options.notifyOnFailure)) {
    throw new GrowthReportError(
      'GROWTH002',
      `Unsupported arguments: ${argv.join(' ')}.`,
      `Usage: ${USAGE}`
    );
  }
  return options;
}

function readConfiguration(env, { dryRun }) {
  const required = ['GROWTH_GITHUB_TOKEN', 'CLOUDFLARE_ANALYTICS_TOKEN', 'CLOUDFLARE_ZONE_ID', ...(dryRun ? [] : ['POSTHOG_PROJECT_TOKEN'])];
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new GrowthReportError(
      'GROWTH001',
      `Missing required settings: ${missing.join(', ')}.`,
      `Add ${missing.join(', ')} to the repository .env file (see docs/operations/growth-report.md).`
    );
  }
  return {
    gitHubToken: env.GROWTH_GITHUB_TOKEN,
    cloudflareToken: env.CLOUDFLARE_ANALYTICS_TOKEN,
    zoneId: env.CLOUDFLARE_ZONE_ID,
    postHogKey: env.POSTHOG_PROJECT_TOKEN,
  };
}

async function runReport(options, io) {
  const configuration = readConfiguration(io.env, options);
  const reportDate = new Date(io.now()).toISOString().slice(0, 10);
  const readings = await readGrowth(configuration, reportDate, io.fetch);
  const { events, skippedDownloadRequests } = buildGrowthEvents({ ...readings, reportDate });
  const scope = `${readings.repositories.length} repositories, ${readings.downloadDays.length} download days, ${skippedDownloadRequests} other download requests skipped (report date ${reportDate})`;
  if (options.dryRun) {
    io.stdout.write(events.map((event) => `${JSON.stringify(event)}\n`).join(''));
    io.stderr.write(`Dry run: built ${events.length} events for ${scope}; nothing was sent.\n`);
    return;
  }
  await sendPostHogBatch(events, { apiKey: configuration.postHogKey, fetch: io.fetch });
  io.stdout.write(`Sent ${events.length} events: ${scope}.\n`);
}

async function readGrowth({ gitHubToken, cloudflareToken, zoneId }, reportDate, fetch) {
  const repositories = [];
  for (const repository of REPOSITORIES) {
    repositories.push(await readRepositoryGrowth(repository, { token: gitHubToken, fetch }));
  }
  const downloadDays = [];
  for (const day of windowDays(reportDate)) {
    downloadDays.push(await readDownloadDay(day, { token: cloudflareToken, zoneId, fetch }));
  }
  return { repositories, downloadDays };
}

function windowDays(reportDate) {
  const reportStart = Date.parse(`${reportDate}T00:00:00Z`);
  return Array.from({ length: WINDOW_DAYS }, (_, index) =>
    new Date(reportStart - (WINDOW_DAYS - index) * DAY_MS).toISOString().slice(0, 10)
  );
}

function reportFailure(error, { notifyOnFailure }, io) {
  const message = error instanceof Error ? error.message : String(error);
  const suggestion = error instanceof GrowthReportError ? `\nSuggestion: ${error.suggestion}` : '';
  io.stderr.write(`[growth-report] ${message}${suggestion}\n`);
  if (!notifyOnFailure) {
    return;
  }
  try {
    io.notify(error instanceof GrowthReportError ? error.code : 'unexpected error');
  } catch (notificationError) {
    io.stderr.write(`[growth-report] Could not show the failure notification: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await reportGrowth({
    argv: process.argv.slice(2),
    env: process.env,
    fetch: globalThis.fetch,
    now: Date.now,
    stdout: process.stdout,
    stderr: process.stderr,
    notify: showFailureNotification,
  });
}
