import { GrowthReportError, networkFailureText } from './errors.mjs';
import { replyShapeProblems } from './reply-shape.mjs';

const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const ACCESS_STATUSES = new Set([401, 403, 404]);

const TRAFFIC_DAYS_SHAPE = (series) => ({
  count: 'number',
  uniques: 'number',
  [series]: [{ timestamp: 'string', count: 'number', uniques: 'number' }],
});

const ENDPOINT_SHAPES = {
  repository: { stargazers_count: 'number' },
  starHistory: [{ week: 'number', total: 'number' }],
  views: TRAFFIC_DAYS_SHAPE('views'),
  clones: TRAFFIC_DAYS_SHAPE('clones'),
  referrers: [{ referrer: 'string', count: 'number', uniques: 'number' }],
  paths: [{ path: 'string', title: 'string', count: 'number', uniques: 'number' }],
};

/**
 * @typedef {{ day: string, count: number, uniques: number }} TrafficDay
 * @typedef {{ count: number, uniques: number, days: TrafficDay[] }} TrafficSeries
 * @typedef {{
 *   repository: string,
 *   starsTotal: number,
 *   starWeeks: { week: number, newStars: number }[],
 *   views: TrafficSeries,
 *   clones: TrafficSeries,
 *   referrers: { referrer: string, count: number, uniques: number }[],
 *   paths: { path: string, title: string, count: number, uniques: number }[],
 * }} RepositoryGrowth
 */

/** @returns {Promise<RepositoryGrowth>} */
export async function readRepositoryGrowth(repository, { token, fetch }) {
  const read = (endpoint, path) => readEndpoint(repository, endpoint, `/repos/${repository}${path}`, { token, fetch });
  const details = (await read('repository', '')).body;
  const views = (await read('views', '/traffic/views')).body;
  const clones = (await read('clones', '/traffic/clones')).body;
  return {
    repository,
    starsTotal: details.stargazers_count,
    starWeeks: await readStarWeeks(repository, { token, fetch }),
    views: trafficSeries(views, views.views),
    clones: trafficSeries(clones, clones.clones),
    referrers: (await read('referrers', '/traffic/popular/referrers')).body,
    paths: (await read('paths', '/traffic/popular/paths')).body,
  };
}

async function readStarWeeks(repository, options) {
  const weeks = [];
  let url = `/repos/${repository}/stargazers/history`;
  while (url) {
    const page = await readEndpoint(repository, 'starHistory', url, options);
    weeks.push(...page.body.map(({ week, total }) => ({ week, newStars: total })));
    url = nextPageUrl(page.headers.get('link'));
  }
  return weeks;
}

function trafficSeries(reply, days) {
  return {
    count: reply.count,
    uniques: reply.uniques,
    days: days.map(({ timestamp, count, uniques }) => ({ day: timestamp.slice(0, 10), count, uniques })),
  };
}

function nextPageUrl(link) {
  return link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
}

async function readEndpoint(repository, endpoint, url, { token, fetch }) {
  const response = await requestGitHub(repository, endpoint, url, { token, fetch });
  if (!response.ok) {
    throw gitHubStatusError(repository, endpoint, response.status);
  }
  const body = await response.json();
  const problems = replyShapeProblems(body, ENDPOINT_SHAPES[endpoint]);
  if (problems.length > 0) {
    throw new GrowthReportError(
      'GROWTH005',
      `GitHub ${endpoint} reply for ${repository} has an unexpected shape: ${problems.join('; ')}.`,
      `Inspect the GitHub ${endpoint} endpoint for ${repository}; its reply format may have changed.`
    );
  }
  return { body, headers: response.headers };
}

async function requestGitHub(repository, endpoint, url, { token, fetch }) {
  try {
    return await fetch(new URL(url, GITHUB_API), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': 'renku-growth-report',
      },
    });
  } catch (error) {
    throw new GrowthReportError(
      'GROWTH004',
      `GitHub ${endpoint} request for ${repository} failed: ${networkFailureText(error)}.`,
      'Check the network connection. The next run re-sends the whole window.'
    );
  }
}

function gitHubStatusError(repository, endpoint, status) {
  if (ACCESS_STATUSES.has(status)) {
    return new GrowthReportError(
      'GROWTH003',
      `GitHub refused ${endpoint} for ${repository} with HTTP ${status}.`,
      'Give GROWTH_GITHUB_TOKEN "Administration: Read-only" on GoRenku/studio and GoRenku/studio-skills, and check that it has not expired.'
    );
  }
  return new GrowthReportError(
    'GROWTH004',
    `GitHub ${endpoint} for ${repository} answered HTTP ${status}.`,
    'Retry later. The next run re-sends the whole window.'
  );
}
