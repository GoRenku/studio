import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import { TELEMETRY_FIELD_LIST_URL, type TelemetryStatus } from '@gorenku/studio-core/client';
import { readTelemetryStatus, setTelemetryChoice } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export interface RunTelemetryCommandOptions {
  input: string[];
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

const TELEMETRY_SUBCOMMANDS: Record<string, (homeDir: string | undefined) => Promise<TelemetryStatus>> = {
  status: (homeDir) => readTelemetryStatus({ homeDir }),
  enable: (homeDir) => setTelemetryChoice({ homeDir, choice: { enabled: true } }),
  disable: (homeDir) => setTelemetryChoice({ homeDir, choice: { enabled: false } }),
};

export async function runTelemetryCommand(options: RunTelemetryCommandOptions): Promise<number> {
  const subcommand = options.input.length === 1 ? TELEMETRY_SUBCOMMANDS[options.input[0] ?? ''] : undefined;
  if (!subcommand) {
    throw unknownTelemetryCommandError(options.input);
  }
  const status = await subcommand(options.homeDir);
  if (options.json) {
    options.io.stdout.log(JSON.stringify(status, null, 2));
    return 0;
  }
  for (const line of formatTelemetryStatus(status)) {
    options.io.stdout.log(line);
  }
  return 0;
}

function formatTelemetryStatus(status: TelemetryStatus): string[] {
  const lines = [`Usage statistics: ${status.enabled ? 'on' : 'off'}`];
  if (status.installId) {
    lines.push(`Install ID: ${status.installId}`);
  }
  if (status.enabled) {
    lines.push(status.blockedBy ? `Sending: no (${status.blockedBy} is set)` : 'Sending: yes');
  }
  lines.push(`Debug printing: ${status.debug ? 'on' : 'off'}`);
  lines.push(`Every field Renku sends: ${TELEMETRY_FIELD_LIST_URL}`);
  return lines;
}

function unknownTelemetryCommandError(input: string[]): StructuredError {
  return new StructuredError({
    code: 'CLI169',
    message: 'Unknown telemetry command.',
    issues: [
      createDiagnosticError(
        'CLI169',
        input.length === 0 ? 'Missing telemetry subcommand.' : `Unsupported telemetry subcommand: ${input.join(' ')}`,
        { path: ['telemetry'], context: 'renku CLI arguments' }
      ),
    ],
    suggestion: 'Use `renku telemetry status`, `renku telemetry enable` or `renku telemetry disable`.',
  });
}
