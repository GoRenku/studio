import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readDownloadDay } from './cloudflare-downloads.mjs';

const reply = JSON.parse(readFileSync(new URL('./fixtures/cloudflare-download-day.json', import.meta.url), 'utf8'));
const TOKEN = 'cf_analytics_secret_value';
const ZONE_ID = 'zone-123';

function cloudflareFetch({ status = 200, body = reply } = {}) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, init, payload: JSON.parse(init.body) });
    return new Response(JSON.stringify(body), { status });
  };
  return { fetch, requests };
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('expected a rejection');
}

test('asks for one day of successful visitor GET requests on the download host', async () => {
  const { fetch, requests } = cloudflareFetch();
  const downloadDay = await readDownloadDay('2026-10-17', { token: TOKEN, zoneId: ZONE_ID, fetch });
  assert.deepEqual(downloadDay.requests[0], { path: '/install.sh', country: 'DE', count: 12 });
  assert.equal(downloadDay.requests.length, 3);
  const [{ url, init, payload }] = requests;
  assert.equal(url, 'https://api.cloudflare.com/client/v4/graphql');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(payload.variables, { zoneTag: ZONE_ID, day: '2026-10-17', host: 'downloads.gorenku.com', limit: 10000 });
  assert.match(payload.query, /requestSource: "eyeball"/);
  assert.match(payload.query, /clientRequestHTTPMethodName: "GET"/);
  assert.match(payload.query, /edgeResponseStatus: 200/);
  assert.match(payload.query, /date: \$day/);
});

for (const status of [401, 403]) {
  test(`HTTP ${status} is an access refusal`, async () => {
    const { fetch } = cloudflareFetch({ status, body: {} });
    const error = await rejection(readDownloadDay('2026-10-17', { token: TOKEN, zoneId: ZONE_ID, fetch }));
    assert.equal(error.code, 'GROWTH007');
    assert.doesNotMatch(`${error.message} ${error.suggestion}`, new RegExp(TOKEN));
  });
}

test('a GraphQL authorization error is an access refusal', async () => {
  const { fetch } = cloudflareFetch({ body: { data: null, errors: [{ message: 'not authorized for that account' }] } });
  const error = await rejection(readDownloadDay('2026-10-17', { token: TOKEN, zoneId: ZONE_ID, fetch }));
  assert.equal(error.code, 'GROWTH007');
});

test('a rejected token reported as HTTP 400 is an access refusal', async () => {
  const body = { success: false, errors: [{ code: 9106, message: 'Authentication failed (status: 400)' }], result: null };
  const { fetch } = cloudflareFetch({ status: 400, body });
  const error = await rejection(readDownloadDay('2026-10-17', { token: TOKEN, zoneId: ZONE_ID, fetch }));
  assert.equal(error.code, 'GROWTH007');
});

test('a zone the key cannot see is an access refusal', async () => {
  const { fetch } = cloudflareFetch({ body: { data: { viewer: { zones: [] } }, errors: null } });
  const error = await rejection(readDownloadDay('2026-10-17', { token: TOKEN, zoneId: ZONE_ID, fetch }));
  assert.equal(error.code, 'GROWTH007');
});

test('HTTP 500, other GraphQL errors and network errors are other Cloudflare failures', async () => {
  const failures = [
    cloudflareFetch({ status: 500, body: {} }).fetch,
    cloudflareFetch({ body: { data: null, errors: [{ message: 'cannot request data older than 2678400s' }] } }).fetch,
    async () => {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
    },
  ];
  for (const fetch of failures) {
    const error = await rejection(readDownloadDay('2026-10-17', { token: TOKEN, zoneId: ZONE_ID, fetch }));
    assert.equal(error.code, 'GROWTH008');
    assert.doesNotMatch(error.message, new RegExp(TOKEN));
  }
});

test('an unexpected reply names every wrong field path without values', async () => {
  const body = { data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: [
    { count: 'many', dimensions: { clientRequestPath: '/install.sh', clientCountryName: 42 } },
  ] }] } } };
  const { fetch } = cloudflareFetch({ body });
  const error = await rejection(readDownloadDay('2026-10-17', { token: TOKEN, zoneId: ZONE_ID, fetch }));
  assert.equal(error.code, 'GROWTH005');
  assert.match(error.message, /httpRequestsAdaptiveGroups\[0\]\.count: expected number/);
  assert.match(error.message, /clientCountryName: expected string/);
  assert.doesNotMatch(error.message, /many|42/);
});
