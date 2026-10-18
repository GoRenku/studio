import { GrowthReportError, networkFailureText } from './errors.mjs';

const POSTHOG_BATCH_URL = 'https://eu.i.posthog.com/batch/';
const REPLY_EXCERPT_LENGTH = 500;

export async function sendPostHogBatch(events, { apiKey, fetch }) {
  let response;
  try {
    response = await fetch(POSTHOG_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, batch: events }),
    });
  } catch (error) {
    throw postHogError(`request failed: ${networkFailureText(error)}`);
  }
  if (!response.ok) {
    const excerpt = (await response.text()).replaceAll(apiKey, '[project token]').slice(0, REPLY_EXCERPT_LENGTH);
    throw postHogError(`answered HTTP ${response.status}: ${excerpt}`);
  }
}

function postHogError(detail) {
  return new GrowthReportError(
    'GROWTH006',
    `PostHog did not accept the batch; it ${detail}.`,
    `Check POSTHOG_PROJECT_TOKEN in .env and that the PostHog EU host ${POSTHOG_BATCH_URL} is reachable.`
  );
}
