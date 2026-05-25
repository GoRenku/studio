import fs from 'node:fs/promises';
import {
  createProjectDataService,
  type LookbookImageGenerationSpec,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';

export async function runGenerationCommand(options: {
  input: string[];
  flags: {
    project?: string;
    purpose?: string;
    target?: string;
    mediaKind?: string;
    provider?: string;
    model?: string;
    file?: string;
    spec?: string;
    approvalToken?: string;
    simulate?: boolean;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [action, nested] = options.input;
  const service = createProjectDataService();

  if (action === 'context') {
    requireLookbookPurpose(options.flags.purpose);
    writeJson(
      options.io,
      await service.buildLookbookImageContext({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        lookbookId: parseLookbookTarget(requiredFlag(options.flags.target, '--target')),
      })
    );
    return 0;
  }

  if (action === 'model' && nested === 'list') {
    requireLookbookPurpose(options.flags.purpose);
    writeJson(
      options.io,
      await service.listLookbookImageModels({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        lookbookId: parseLookbookTarget(requiredFlag(options.flags.target, '--target')),
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'validate') {
    writeJson(
      options.io,
      await service.validateLookbookImageSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        spec: await readSpec(requiredFlag(options.flags.file, '--file')),
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'create') {
    writeJson(
      options.io,
      await service.createLookbookImageSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        spec: await readSpec(requiredFlag(options.flags.file, '--file')),
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'update') {
    writeJson(
      options.io,
      await service.updateLookbookImageSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        specId: requiredFlag(options.flags.spec, '--spec'),
        spec: await readSpec(requiredFlag(options.flags.file, '--file')),
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'show') {
    writeJson(
      options.io,
      await service.readLookbookImageSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        specId: requiredFlag(options.flags.spec, '--spec'),
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'list') {
    requireLookbookPurpose(options.flags.purpose);
    writeJson(
      options.io,
      await service.listLookbookImageSpecs({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        lookbookId: parseLookbookTarget(requiredFlag(options.flags.target, '--target')),
      })
    );
    return 0;
  }

  if (action === 'estimate') {
    writeJson(
      options.io,
      await service.estimateLookbookImageSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        specId: requiredFlag(options.flags.spec, '--spec'),
      })
    );
    return 0;
  }

  if (action === 'run') {
    writeJson(
      options.io,
      await service.runLookbookImageSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        specId: requiredFlag(options.flags.spec, '--spec'),
        approvalToken: options.flags.approvalToken,
        simulate: options.flags.simulate,
      })
    );
    return 0;
  }

  throw new StructuredError({
    code: 'CLI019',
    message: `Unknown generation command: ${options.input.join(' ') || '(none)'}.`,
    suggestion:
      'Use generation context, generation model list, generation spec validate/create/update/show/list, generation estimate, or generation run.',
  });
}

async function readSpec(filePath: string): Promise<LookbookImageGenerationSpec> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as LookbookImageGenerationSpec;
}

function requireLookbookPurpose(value: string | undefined): void {
  const purpose = requiredFlag(value, '--purpose');
  if (purpose !== 'lookbook.image') {
    throw new StructuredError({
      code: 'CLI024',
      message: `Unsupported generation purpose: ${purpose}.`,
      suggestion: 'Use --purpose lookbook.image.',
    });
  }
}

function parseLookbookTarget(value: string): string {
  const [kind, id, extra] = value.split(':');
  if (kind !== 'lookbook' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `Lookbook image generation target must use lookbook:<id>. Received: ${value}.`,
      suggestion: 'Use --target lookbook:<lookbook-id>.',
    });
  }
  return id;
}

function requiredFlag(value: string | undefined, flag: string): string {
  if (!value) {
    throw new StructuredError({
      code: 'CLI001',
      message: `Missing required flag: ${flag}.`,
    });
  }
  return value;
}

function writeJson(io: RenkuCliIo, value: unknown): void {
  io.stdout.log(JSON.stringify(value, null, 2));
}
