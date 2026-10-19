import type { TelemetryBlock } from '../../client/telemetry.js';

export type TelemetryEnvironment = Readonly<Record<string, string | undefined>>;

/** Checked in this order; the first switch that is set is reported. */
const TELEMETRY_BLOCKS: readonly TelemetryBlock[] = ['DO_NOT_TRACK', 'RENKU_TELEMETRY_DISABLED', 'CI'];

export function readTelemetryBlock(environment: TelemetryEnvironment): TelemetryBlock | null {
  return TELEMETRY_BLOCKS.find((name) => isSwitchSet(environment[name])) ?? null;
}

export function isTelemetryDebugEnabled(environment: TelemetryEnvironment): boolean {
  return isSwitchSet(environment.RENKU_TELEMETRY_DEBUG);
}

/** Any value except an empty string, `0` or `false` turns a switch on. */
function isSwitchSet(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
}
