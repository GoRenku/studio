import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import {
  GENERATION_LANES,
  GENERATION_LANE_SLUGS,
  type GenerationLane,
  type GenerationLaneModel,
  type UpdateGenerationLaneSettingsChange,
} from '@gorenku/studio-core/client';
import { createProjectDataService } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../../cli.js';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';

export interface GenerationLaneCommandFlags {
  project?: string;
  lane?: string;
  provider?: string;
  model?: string;
  modelName?: string;
  clearModel?: boolean;
  chooseRoute?: string;
  askBeforeGenerating?: string;
}

export interface RunGenerationLaneCommandOptions {
  input: string[];
  flags: GenerationLaneCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

type ProjectDataService = ReturnType<typeof createProjectDataService>;

const subcommands: Record<string, (options: RunGenerationLaneCommandOptions) => Promise<number>> = {
  show: showGenerationLanes,
  set: setGenerationLane,
};

export async function runGenerationLaneCommand(
  options: RunGenerationLaneCommandOptions
): Promise<number> {
  const run = subcommands[options.input[0] ?? ''];
  if (!run) {
    throw invalidFlag('subcommand', 'Unknown settings generation command. Usage: renku settings generation show|set ...');
  }
  return run(options);
}

async function showGenerationLanes(options: RunGenerationLaneCommandOptions): Promise<number> {
  const service = createProjectDataService();
  const projectName = await resolveProjectName(service, options);
  const resource = await service.readProjectSettings({ projectName, homeDir: options.homeDir });
  const lanes = options.flags.lane ? [parseLane(options.flags.lane)] : [...GENERATION_LANES];
  const report = {
    enableProviderPromptExpansion: resource.settings.generation.enableProviderPromptExpansion,
    lanes: Object.fromEntries(lanes.map((lane) => [lane, resource.settings.generation[lane]])),
  };
  if (!options.json) {
    options.io.stdout.log(`Generation Settings: ${resource.project.name}`);
  }
  options.io.stdout.log(JSON.stringify(report, null, 2));
  return 0;
}

async function setGenerationLane(options: RunGenerationLaneCommandOptions): Promise<number> {
  const change = parseLaneChange(options.flags);
  const service = createProjectDataService();
  const projectName = await resolveProjectName(service, options);
  const report = await service.updateGenerationLaneSettings({
    projectName,
    homeDir: options.homeDir,
    ...change,
  });
  await appendStudioResourceChangedEvent({
    runtime: {
      projectName,
      homeDir: options.homeDir,
      json: options.json,
      io: options.io,
      projectDataService: service,
    },
    report: {
      project: {
        projectName: report.resource.project.name,
        id: report.resource.project.id,
      },
      resourceKeys: report.resourceKeys,
    },
    command: 'renku settings generation set',
  });
  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
  } else {
    options.io.stdout.log(`Generation lane updated: ${GENERATION_LANE_SLUGS[change.lane]}`);
    options.io.stdout.log(JSON.stringify(report.resource.settings.generation[change.lane], null, 2));
  }
  return 0;
}

function parseLaneChange(flags: GenerationLaneCommandFlags): UpdateGenerationLaneSettingsChange {
  if (!flags.lane) {
    throw invalidFlag('lane', 'Missing required flag: --lane.');
  }
  const change: UpdateGenerationLaneSettingsChange = { lane: parseLane(flags.lane) };
  if (flags.provider !== undefined) {
    change.provider = flags.provider;
  }
  const model = parseModel(flags);
  if (model !== undefined) {
    change.model = model;
  }
  if (flags.chooseRoute !== undefined) {
    change.chooseRouteBeforeGenerating = parseOnOff(flags.chooseRoute, 'choose-route');
  }
  if (flags.askBeforeGenerating !== undefined) {
    change.askBeforeGenerating = parseOnOff(flags.askBeforeGenerating, 'ask-before-generating');
  }
  return change;
}

function parseLane(value: string): GenerationLane {
  const lane = GENERATION_LANES.find((candidate) => GENERATION_LANE_SLUGS[candidate] === value);
  if (!lane) {
    const accepted = GENERATION_LANES.map((candidate) => GENERATION_LANE_SLUGS[candidate]).join(', ');
    throw invalidFlag('lane', `Unknown generation lane: ${value}. Use one of: ${accepted}.`);
  }
  return lane;
}

function parseModel(flags: GenerationLaneCommandFlags): GenerationLaneModel | null | undefined {
  if (flags.clearModel) {
    if (flags.model !== undefined || flags.modelName !== undefined) {
      throw invalidFlag('clear-model', 'Use either --clear-model or --model with --model-name, not both.');
    }
    return null;
  }
  if (flags.model === undefined && flags.modelName === undefined) {
    return undefined;
  }
  if (!flags.model || !flags.modelName) {
    throw invalidFlag('model', '--model and --model-name must be provided together.');
  }
  return { key: flags.model, name: flags.modelName };
}

function parseOnOff(value: string, flag: string): boolean {
  if (value === 'on') {
    return true;
  }
  if (value === 'off') {
    return false;
  }
  throw invalidFlag(flag, `--${flag} must be on or off.`);
}

async function resolveProjectName(
  service: ProjectDataService,
  options: RunGenerationLaneCommandOptions
): Promise<string> {
  const project = await service.resolveStudioProjectRef({
    projectName: options.flags.project,
    homeDir: options.homeDir,
  });
  return project.name;
}

function invalidFlag(flag: string, message: string): StructuredError {
  return new StructuredError({
    code: 'CLI167',
    message,
    issues: [
      createDiagnosticError(
        'CLI167',
        message,
        { path: [flag], context: 'renku settings generation' },
        'Run renku settings generation set --lane image|image-edit|video|audio with --provider, --model and --model-name, --clear-model, --choose-route on|off or --ask-before-generating on|off.'
      ),
    ],
  });
}
