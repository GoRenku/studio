import type { TelemetryEvent } from '../../client/telemetry.js';

// The website's public PostHog project token. It can only write events.
const POSTHOG_PROJECT_TOKEN = 'phc_rTTOTmP5c7ZzNTKVMbVwEzmyofCP3dio7ZSI1Zavub6';
const POSTHOG_CAPTURE_URL = 'https://eu.i.posthog.com/i/v0/e/';
const SEND_TIMEOUT_MS = 2_000;
const DEBUG_PREFIX = 'renku usage statistics (debug, not sent):';

type TelemetryEventName = TelemetryEvent['name'];
type TelemetryEventProperties = Record<string, string>;

/**
 * Every event's extra properties. The public field list in the Privacy Notice
 * (gorenku.com/privacy#app-usage-statistics) must change with this table.
 */
const EVENT_PROPERTIES: {
  [Name in TelemetryEventName]: (event: Extract<TelemetryEvent, { name: Name }>) => TelemetryEventProperties;
} = {
  studio_started: () => ({}),
  project_created: () => ({}),
  fdx_imported: () => ({}),
  sample_film_download_started: () => ({}),
  sample_film_download_finished: (event): TelemetryEventProperties =>
    event.result === 'failed' ? { result: 'failed', error_code: event.errorCode } : { result: 'installed' },
  sample_film_opened: () => ({}),
  generation_completed: (event) => ({ media_kind: event.mediaKind }),
  heard_about: (event) => ({ answer: event.answer }),
  telemetry_opted_out: () => ({}),
};

export interface TelemetryEventContext {
  installId: string;
  version: string;
  platform: string;
  arch: string;
  timestamp: string;
}

export interface TelemetryRequestBody {
  api_key: string;
  event: TelemetryEventName;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, string | boolean>;
}

export function buildTelemetryRequestBody(
  event: TelemetryEvent,
  context: TelemetryEventContext
): TelemetryRequestBody {
  const extraProperties = (EVENT_PROPERTIES[event.name] as (value: TelemetryEvent) => TelemetryEventProperties)(event);
  return {
    api_key: POSTHOG_PROJECT_TOKEN,
    event: event.name,
    distinct_id: context.installId,
    timestamp: context.timestamp,
    properties: {
      surface: 'studio',
      version: context.version,
      platform: context.platform,
      arch: context.arch,
      ...extraProperties,
      $geoip_disable: true,
    },
  };
}

export interface TelemetryDelivery {
  debug: boolean;
  fetcher: typeof fetch;
  printDebug: (line: string) => void;
}

/** Sends one event, or prints it in debug mode. Never throws. */
export async function deliverTelemetryEvent(
  body: TelemetryRequestBody,
  delivery: TelemetryDelivery
): Promise<void> {
  if (delivery.debug) {
    const { api_key: _token, ...printable } = body;
    delivery.printDebug(`${DEBUG_PREFIX} ${JSON.stringify(printable)}`);
    return;
  }
  try {
    await delivery.fetcher(POSTHOG_CAPTURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch {
    // An optional side channel: a failed send skips the event.
  }
}
