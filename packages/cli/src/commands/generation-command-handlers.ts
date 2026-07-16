import type { GenerationSpec } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { notifyStudioGenerationPreviews } from './studio-notification-client.js';
import { parseGenerationPurpose, parseGenerationTarget } from './generation-purpose-command-registry.js';
import { readJsonFile, requiredFlag, type CliCommandHandler, type CliCommandRuntime } from './structured-command.js';

export interface GenerationCommandFlags {
  project?: string;
  purpose?: string;
  target?: string;
  mediaKind?: string;
  provider?: string;
  model?: string;
  file?: string | string[];
  spec?: string | string[];
  run?: string;
  approvalToken?: string;
  simulate?: boolean;
  search?: string;
  cursor?: string;
  scene?: string;
  dialogue?: string;
  take?: string;
  kind?: string;
}

export type GenerationCommandRuntime = CliCommandRuntime;
type Input = Parameters<CliCommandHandler<GenerationCommandFlags, GenerationCommandRuntime>['run']>[0];

export const generationCommandHandlers = [
  { path: ['context'], run: runContext },
  { path: ['reference', 'list'], run: runReferenceList },
  { path: ['model', 'list'], run: runModelList },
  { path: ['validate'], run: runValidate },
  { path: ['spec', 'create'], run: runSpecCreate },
  { path: ['spec', 'update'], run: runSpecUpdate },
  { path: ['spec', 'show'], run: runSpecShow },
  { path: ['spec', 'list'], run: runSpecList },
  { path: ['preview', 'show'], run: runPreviewShow },
  { path: ['estimate'], run: runEstimate },
  { path: ['run'], run: runGeneration },
  { path: ['run', 'show'], run: runGenerationShow },
] satisfies CliCommandHandler<GenerationCommandFlags, GenerationCommandRuntime>[];

async function runContext(input: Input) {
  const purpose = parseGenerationPurpose(requiredFlag(input.flags.purpose, '--purpose'));
  return input.runtime.projectDataService.buildGenerationContext({
    ...projectInput(input),
    purpose,
    target: parseGenerationTarget({ purpose, target: requiredFlag(input.flags.target, '--target') }),
  });
}

async function runReferenceList(input: Input) {
  return input.runtime.projectDataService.listGenerationReferences({
    ...projectInput(input),
    mediaKind: parseMediaKind(input.flags.mediaKind),
    search: input.flags.search,
    cursor: input.flags.cursor,
  });
}

async function runModelList(input: Input) {
  const purpose = parseGenerationPurpose(requiredFlag(input.flags.purpose, '--purpose'));
  return input.runtime.projectDataService.listGenerationModels({
    ...projectInput(input),
    purpose,
  });
}

async function runValidate(input: Input) {
  return input.runtime.projectDataService.validateGenerationSpec({ ...projectInput(input), spec: await readSpec(requiredFlag(singleFlag(input.flags.file), '--file')) });
}
async function runSpecCreate(input: Input) {
  return input.runtime.projectDataService.createGenerationSpec({ ...projectInput(input), spec: await readSpec(requiredFlag(singleFlag(input.flags.file), '--file')) });
}
async function runSpecUpdate(input: Input) {
  return input.runtime.projectDataService.updateGenerationSpec({ ...projectInput(input), specId: requiredFlag(singleFlag(input.flags.spec), '--spec'), spec: await readSpec(requiredFlag(singleFlag(input.flags.file), '--file')) });
}
async function runSpecShow(input: Input) {
  return input.runtime.projectDataService.readGenerationSpec({ ...projectInput(input), specId: requiredFlag(singleFlag(input.flags.spec), '--spec') });
}
async function runSpecList(input: Input) {
  return input.runtime.projectDataService.listGenerationSpecs({
    ...projectInput(input),
    ...(input.flags.purpose ? { purpose: parseGenerationPurpose(input.flags.purpose) } : {}),
  });
}
async function runPreviewShow(input: Input) {
  const files = flagValues(input.flags.file);
  const specIds = flagValues(input.flags.spec);
  if (files.length > 0 && specIds.length > 0) {
    throw new StructuredError({ code: 'CLI145', message: 'generation preview show accepts either --file or --spec, not both.', suggestion: 'Choose a draft JSON file or a saved spec id.' });
  }
  if (files.length === 0 && specIds.length === 0) {
    requiredFlag(undefined, '--file or --spec');
  }
  const previews = specIds.length > 0
    ? await Promise.all(specIds.map((specId) =>
        input.runtime.projectDataService.buildGenerationPreview({ ...projectInput(input), specId })
      ))
    : await Promise.all(files.map(async (file) =>
        input.runtime.projectDataService.buildGenerationPreview({ ...projectInput(input), spec: await readSpec(file) })
      ));
  const project = await input.runtime.projectDataService.readProject({ projectName: requiredProjectName(input) });
  const delivery = await notifyStudioGenerationPreviews({
    homeDir: input.runtime.homeDir,
    notification: {
      projectRef: { name: project.identity.name, id: project.identity.id, storageRoot: project.identity.folderPath },
      previews,
      source: { kind: 'cli', command: 'generation preview show' },
    },
  });
  if (delivery.status !== 'delivered') {
    throw previewDeliveryError(delivery);
  }
  return { valid: true, requestCount: previews.length, studio: { delivery: 'delivered' } };
}
async function runEstimate(input: Input) {
  return input.runtime.projectDataService.estimateGeneration({ ...projectInput(input), specId: requiredFlag(singleFlag(input.flags.spec), '--spec') });
}
async function runGeneration(input: Input) {
  return input.runtime.projectDataService.runGeneration({
    ...projectInput(input),
    specId: requiredFlag(singleFlag(input.flags.spec), '--spec'),
    approvalToken: requiredFlag(input.flags.approvalToken, '--approval-token'),
    mode: input.flags.simulate ? 'simulated' : 'live',
  });
}
async function runGenerationShow(input: Input) {
  return input.runtime.projectDataService.readGenerationRun({ ...projectInput(input), runId: requiredFlag(input.flags.run, '--run') });
}

async function readSpec(file: string): Promise<GenerationSpec> { return await readJsonFile(file) as GenerationSpec; }
function projectInput(input: Input) { return { projectName: input.runtime.projectName, homeDir: input.runtime.homeDir }; }
function requiredProjectName(input: Input) { return requiredFlag(input.runtime.projectName, '--project'); }
function parseMediaKind(value?: string): 'image' | 'audio' | 'video' | undefined {
  if (!value) {
    return undefined;
  }
  if (value === 'image' || value === 'audio' || value === 'video') {
    return value;
  }
  throw new StructuredError({ code: 'CLI149', message: `Unsupported media kind: ${value}.`, suggestion: 'Use image, audio, or video.' });
}
function flagValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
function singleFlag(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.at(-1) : value;
}
function previewDeliveryError(delivery: Exclude<Awaited<ReturnType<typeof notifyStudioGenerationPreviews>>, { status: 'delivered' }>) {
  return new StructuredError({ code: 'CLI144', message: delivery.status === 'deliveryFailed' ? delivery.detail : 'Studio is not available to show the generation preview.', suggestion: 'Start Studio for the project and retry.' });
}
