import { randomUUID } from 'node:crypto';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { AssetFile } from '../../client/asset-files.js';
import {
  HEARD_ABOUT_RENKU_ANSWERS,
  type HeardAboutRenkuAnswer,
  type TelemetryChoice,
  type TelemetryEvent,
  type TelemetryStatus,
} from '../../client/telemetry.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { readInstalledRenkuRelease } from '../installation/installed-release.js';
import { buildTelemetryRequestBody, deliverTelemetryEvent } from './capture.js';
import { deleteTelemetryChoiceFile, readTelemetryInstallId, writeTelemetryInstallId } from './choice-file.js';
import { isTelemetryDebugEnabled, readTelemetryBlock, type TelemetryEnvironment } from './environment.js';
import { telemetryChoiceInvalidError, telemetryChoiceIssue } from './errors.js';

/** Test seams; not exported from the package. */
export interface TelemetryRuntimeOptions {
  environment?: TelemetryEnvironment;
  fetcher?: typeof fetch;
  printDebug?: (line: string) => void;
  readVersion?: () => string;
  now?: () => Date;
}

const DEBUG_SKIP_PREFIX = 'renku usage statistics (debug, skipped):';
const GENERATED_MEDIA_KINDS = ['image', 'video', 'audio'] as const;

export function readTelemetryStatus(options: RenkuConfigPathOptions = {}): Promise<TelemetryStatus> {
  return readTelemetryStatusWithOptions(options, {});
}

export async function readTelemetryStatusWithOptions(
  options: RenkuConfigPathOptions,
  runtime: TelemetryRuntimeOptions
): Promise<TelemetryStatus> {
  const environment = runtime.environment ?? process.env;
  const installId = await readTelemetryInstallId(options);
  return {
    enabled: installId !== null,
    installId,
    blockedBy: readTelemetryBlock(environment),
    debug: isTelemetryDebugEnabled(environment),
  };
}

export function setTelemetryChoice(
  input: RenkuConfigPathOptions & { choice: TelemetryChoice }
): Promise<TelemetryStatus> {
  return setTelemetryChoiceWithOptions(input, {});
}

export async function setTelemetryChoiceWithOptions(
  input: RenkuConfigPathOptions & { choice: TelemetryChoice },
  runtime: TelemetryRuntimeOptions
): Promise<TelemetryStatus> {
  const choice = validateTelemetryChoice(input.choice);
  const options: RenkuConfigPathOptions = { homeDir: input.homeDir };
  if (choice.enabled) {
    await turnTelemetryOn(options);
    if (choice.heardAbout) {
      await recordTelemetryEventWithOptions({ name: 'heard_about', answer: choice.heardAbout }, options, runtime);
    }
  } else {
    await turnTelemetryOff(options, runtime);
  }
  return readTelemetryStatusWithOptions(options, runtime);
}

/** Records one event when the user said yes and nothing blocks it. Never rejects. */
export function recordTelemetryEvent(event: TelemetryEvent, options: RenkuConfigPathOptions = {}): Promise<void> {
  return recordTelemetryEventWithOptions(event, options, {});
}

export async function recordTelemetryEventWithOptions(
  event: TelemetryEvent,
  options: RenkuConfigPathOptions,
  runtime: TelemetryRuntimeOptions
): Promise<void> {
  const environment = runtime.environment ?? process.env;
  if (readTelemetryBlock(environment) !== null) {
    return;
  }
  const debug = isTelemetryDebugEnabled(environment);
  const printDebug = runtime.printDebug ?? printToStderr;
  try {
    const installId = await readTelemetryInstallId({ homeDir: options.homeDir });
    if (installId === null) {
      return;
    }
    await sendTelemetryEvent(event, installId, { ...runtime, environment, printDebug });
  } catch (error) {
    if (debug) {
      printDebug(`${DEBUG_SKIP_PREFIX} ${event.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * The event for generated files saved into a Project: the first returned
 * AssetFile with generation origin and an image, video or audio media kind.
 */
export function generationCompletedEvent(assetFiles: readonly AssetFile[]): TelemetryEvent | null {
  for (const assetFile of assetFiles) {
    const mediaKind = GENERATED_MEDIA_KINDS.find((kind) => kind === assetFile.mediaKind);
    if (assetFile.origin === 'generated' && mediaKind) {
      return { name: 'generation_completed', mediaKind };
    }
  }
  return null;
}

/** Records `generation_completed` when the saved files include a generated media file. */
export function recordGenerationCompleted(assetFiles: readonly AssetFile[], options: RenkuConfigPathOptions): void {
  const event = generationCompletedEvent(assetFiles);
  if (event) {
    void recordTelemetryEvent(event, options);
  }
}

async function turnTelemetryOn(options: RenkuConfigPathOptions): Promise<void> {
  if (await readTelemetryInstallId(options) === null) {
    await writeTelemetryInstallId(randomUUID(), options);
  }
}

async function turnTelemetryOff(options: RenkuConfigPathOptions, runtime: TelemetryRuntimeOptions): Promise<void> {
  const environment = runtime.environment ?? process.env;
  // An unreadable or invalid file is deleted without sending anything.
  const installId = await readTelemetryInstallId(options).catch(() => null);
  // Revoke recording before the final request can wait on the network.
  await deleteTelemetryChoiceFile(options);
  if (installId !== null && readTelemetryBlock(environment) === null) {
    await sendTelemetryEvent({ name: 'telemetry_opted_out' }, installId, {
      ...runtime,
      environment,
      printDebug: runtime.printDebug ?? printToStderr,
    }).catch(() => undefined);
  }
}

async function sendTelemetryEvent(
  event: TelemetryEvent,
  installId: string,
  runtime: TelemetryRuntimeOptions & { environment: TelemetryEnvironment; printDebug: (line: string) => void }
): Promise<void> {
  const body = buildTelemetryRequestBody(event, {
    installId,
    version: (runtime.readVersion ?? readRenkuVersion)(),
    platform: process.platform,
    arch: process.arch,
    timestamp: (runtime.now?.() ?? new Date()).toISOString(),
  });
  await deliverTelemetryEvent(body, {
    debug: isTelemetryDebugEnabled(runtime.environment),
    fetcher: runtime.fetcher ?? fetch,
    printDebug: runtime.printDebug,
  });
}

function readRenkuVersion(): string {
  return readInstalledRenkuRelease()?.version ?? 'development';
}

function validateTelemetryChoice(choice: TelemetryChoice): TelemetryChoice {
  const issues: DiagnosticIssue[] = [];
  if (!choice || typeof choice !== 'object' || typeof choice.enabled !== 'boolean') {
    throw telemetryChoiceInvalidError([telemetryChoiceIssue('enabled', 'enabled must be true or false.')]);
  }
  if (choice.heardAbout !== undefined) {
    if (!isHeardAboutRenkuAnswer(choice.heardAbout)) {
      issues.push(telemetryChoiceIssue('heardAbout', `heardAbout must be one of: ${HEARD_ABOUT_RENKU_ANSWERS.join(', ')}.`));
    }
    if (!choice.enabled) {
      issues.push(telemetryChoiceIssue('heardAbout', 'heardAbout is accepted only when usage statistics are turned on.'));
    }
  }
  if (issues.length > 0) {
    throw telemetryChoiceInvalidError(issues);
  }
  return choice;
}

function isHeardAboutRenkuAnswer(value: unknown): value is HeardAboutRenkuAnswer {
  return typeof value === 'string' && (HEARD_ABOUT_RENKU_ANSWERS as readonly string[]).includes(value);
}

function printToStderr(line: string): void {
  process.stderr.write(`${line}\n`);
}
