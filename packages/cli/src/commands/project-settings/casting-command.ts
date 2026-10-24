import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import { createProjectDataService } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../../cli.js';
import { readRequiredJsonInput, requiredFlag, writeJson } from '../command-io.js';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';

export interface RunCastingSettingsCommandOptions {
  input: string[];
  flags: { project?: string; file?: string };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

const subcommands: Record<string, (options: RunCastingSettingsCommandOptions) => Promise<number>> = {
  show: showCastingSettings,
  set: setCastingSettings,
};

/** `renku settings casting show|set`: the models and counts that pre-fill a casting round. */
export async function runCastingSettingsCommand(options: RunCastingSettingsCommandOptions): Promise<number> {
  const run = subcommands[options.input[0] ?? ''];
  if (!run) {
    throw new StructuredError({
      code: 'CLI020',
      message: 'Unknown settings casting command. Usage: renku settings casting show|set --file <casting.json>',
      issues: [createDiagnosticError('CLI020', 'Unknown settings casting command.', { path: ['settings', 'casting'], context: 'renku CLI arguments' }, 'Run renku settings casting show, or renku settings casting set --file <casting.json>.')],
    });
  }
  return run(options);
}

async function showCastingSettings(options: RunCastingSettingsCommandOptions): Promise<number> {
  const service = createProjectDataService();
  writeJson(options.io, await service.showCastingSettings({ homeDir: options.homeDir, ...projectName(options) }));
  return 0;
}

async function setCastingSettings(options: RunCastingSettingsCommandOptions): Promise<number> {
  const service = createProjectDataService();
  const filePath = requiredFlag(options.flags.file, '--file');
  const report = await service.setCastingSettings({
    homeDir: options.homeDir,
    ...projectName(options),
    casting: await readRequiredJsonInput(filePath, 'settings casting set'),
    ...(filePath !== '-' ? { filePath } : {}),
  });
  await appendStudioResourceChangedEvent({
    runtime: { projectName: options.flags.project, homeDir: options.homeDir, json: options.json, io: options.io, projectDataService: service },
    report,
    command: 'settings casting set',
  });
  writeJson(options.io, report);
  return 0;
}

function projectName(options: RunCastingSettingsCommandOptions): { projectName?: string } {
  return options.flags.project ? { projectName: options.flags.project } : {};
}
