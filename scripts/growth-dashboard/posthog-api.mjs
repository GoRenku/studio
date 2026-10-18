import { GrowthDashboardError } from './errors.mjs';

const POSTHOG_APP = 'https://eu.posthog.com';
const ACCESS_STATUSES = new Set([401, 403]);
const REPLY_EXCERPT_LENGTH = 400;

/** A small client for the PostHog app API, authenticated with a personal API key. */
export function postHogApi({ apiKey, fetch }) {
  async function request(method, path, body) {
    let response;
    try {
      response = await fetch(new URL(path, POSTHOG_APP), {
        method,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      throw new GrowthDashboardError('DASHBOARD003', `PostHog ${method} ${path} failed: ${error instanceof Error ? error.message : 'network error'}.`, 'Check the network connection and run it again.');
    }
    const text = await response.text();
    if (!response.ok) {
      throw statusError(method, path, response.status, text.replaceAll(apiKey, '[personal API key]'));
    }
    return text ? JSON.parse(text) : null;
  }
  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
  };
}

function statusError(method, path, status, text) {
  const excerpt = text.slice(0, REPLY_EXCERPT_LENGTH);
  if (ACCESS_STATUSES.has(status)) {
    return new GrowthDashboardError(
      'DASHBOARD002',
      `PostHog refused ${method} ${path} with HTTP ${status}: ${excerpt}`,
      'Give POSTHOG_PERSONAL_API_KEY Dashboard: Write, Insight: Write, Query: Read and Project: Read on the Renku Website project.'
    );
  }
  return new GrowthDashboardError('DASHBOARD003', `PostHog ${method} ${path} answered HTTP ${status}: ${excerpt}`, 'Run it again; if it repeats, check the request in the PostHog API reference.');
}
