import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readRepositoryGrowth } from './github-api.mjs';

const replies = JSON.parse(readFileSync(new URL('./fixtures/github-replies.json', import.meta.url), 'utf8'));
const TOKEN = 'github_pat_secret_value';
const REPOSITORY = 'GoRenku/studio';

function gitHubFetch({ statusFor = () => 200, bodyFor = () => undefined } = {}) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url: String(url), headers: init.headers });
    const path = new URL(url).pathname + new URL(url).search;
    const status = statusFor(path);
    const body = bodyFor(path) ?? defaultBody(path);
    const headers = new Headers(path.endsWith('/stargazers/history')
      ? { link: `<https://api.github.com/repos/${REPOSITORY}/stargazers/history?page=2>; rel="next"` }
      : {});
    return new Response(JSON.stringify(body), { status, headers });
  };
  return { fetch, requests };
}

function defaultBody(path) {
  const endpoint = path.replace(`/repos/${REPOSITORY}`, '');
  const bodies = {
    '': replies.repository,
    '/stargazers/history': replies.starHistoryPages[0],
    '/stargazers/history?page=2': replies.starHistoryPages[1],
    '/traffic/views': replies.views,
    '/traffic/clones': replies.clones,
    '/traffic/popular/referrers': replies.referrers,
    '/traffic/popular/paths': replies.paths,
  };
  return bodies[endpoint];
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('expected a rejection');
}

test('reads every endpoint with the GitHub headers and follows star-history pages', async () => {
  const { fetch, requests } = gitHubFetch();
  const growth = await readRepositoryGrowth(REPOSITORY, { token: TOKEN, fetch });
  assert.equal(growth.starsTotal, 7);
  assert.deepEqual(growth.starWeeks.map(({ newStars }) => newStars), [3, 1, 3]);
  assert.deepEqual(growth.views.days[0], { day: '2026-10-16', count: 5, uniques: 2 });
  assert.equal(growth.clones.uniques, 15);
  assert.equal(growth.paths[1].path, '/gorenku/studio');
  assert.equal(requests.length, 7);
  for (const { headers } of requests) {
    assert.equal(headers.Authorization, `Bearer ${TOKEN}`);
    assert.equal(headers.Accept, 'application/vnd.github+json');
    assert.equal(headers['X-GitHub-Api-Version'], '2026-03-10');
    assert.equal(headers['User-Agent'], 'renku-growth-report');
  }
});

for (const status of [401, 403, 404]) {
  test(`HTTP ${status} is an access refusal`, async () => {
    const { fetch } = gitHubFetch({ statusFor: (path) => (path.endsWith('/traffic/views') ? status : 200) });
    const error = await rejection(readRepositoryGrowth(REPOSITORY, { token: TOKEN, fetch }));
    assert.equal(error.code, 'GROWTH003');
    assert.match(error.message, /views for GoRenku\/studio/);
    assert.doesNotMatch(`${error.message} ${error.suggestion}`, new RegExp(TOKEN));
  });
}

for (const status of [422, 500]) {
  test(`HTTP ${status} is another GitHub failure`, async () => {
    const { fetch } = gitHubFetch({ statusFor: (path) => (path.endsWith('/clones') ? status : 200) });
    const error = await rejection(readRepositoryGrowth(REPOSITORY, { token: TOKEN, fetch }));
    assert.equal(error.code, 'GROWTH004');
    assert.match(error.message, new RegExp(`HTTP ${status}`));
  });
}

test('a network error is another GitHub failure without the token', async () => {
  const fetch = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
  };
  const error = await rejection(readRepositoryGrowth(REPOSITORY, { token: TOKEN, fetch }));
  assert.equal(error.code, 'GROWTH004');
  assert.match(error.message, /ENOTFOUND/);
  assert.doesNotMatch(error.message, new RegExp(TOKEN));
});

test('an unexpected reply names every wrong field path without values', async () => {
  const { fetch } = gitHubFetch({
    bodyFor: (path) => (path.endsWith('/traffic/views')
      ? { count: 'thirty', uniques: 12, views: [{ timestamp: 'secret-day', count: null, uniques: 2 }] }
      : undefined),
  });
  const error = await rejection(readRepositoryGrowth(REPOSITORY, { token: TOKEN, fetch }));
  assert.equal(error.code, 'GROWTH005');
  assert.match(error.message, /reply\.count: expected number/);
  assert.match(error.message, /reply\.views\[0\]\.count: expected number/);
  assert.doesNotMatch(error.message, /thirty|secret-day/);
});
