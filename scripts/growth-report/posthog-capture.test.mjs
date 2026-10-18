import assert from 'node:assert/strict';
import test from 'node:test';
import { sendPostHogBatch } from './posthog-capture.mjs';

const API_KEY = 'phc_project_token_value';
const EVENTS = [{ event: 'github_views_day', distinct_id: 'github:GoRenku/studio', properties: {} }];

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('expected a rejection');
}

test('posts one batch to the PostHog EU endpoint', async () => {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, init });
    return new Response('{"status":"Ok"}', { status: 200 });
  };
  await sendPostHogBatch(EVENTS, { apiKey: API_KEY, fetch });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://eu.i.posthog.com/batch/');
  assert.equal(requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].init.body), { api_key: API_KEY, batch: EVENTS });
});

test('a refused batch reports the status and a reply excerpt without the token', async () => {
  const fetch = async () => new Response(`invalid key ${API_KEY} ${'x'.repeat(900)}`, { status: 401 });
  const error = await rejection(sendPostHogBatch(EVENTS, { apiKey: API_KEY, fetch }));
  assert.equal(error.code, 'GROWTH006');
  assert.match(error.message, /HTTP 401: invalid key \[project token\]/);
  assert.doesNotMatch(error.message, new RegExp(API_KEY));
  assert.ok(error.message.length < 700);
});

test('a network error is a refused batch', async () => {
  const fetch = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
  };
  const error = await rejection(sendPostHogBatch(EVENTS, { apiKey: API_KEY, fetch }));
  assert.equal(error.code, 'GROWTH006');
  assert.match(error.message, /ECONNREFUSED/);
});
