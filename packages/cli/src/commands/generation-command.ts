import fs from 'node:fs/promises';
import {
  createProjectDataService,
  type MediaGenerationPurpose,
  type MediaGenerationRequestTarget,
  type MediaGenerationSpec,
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
    shotList?: string;
    shots?: string;
    productionGroup?: string;
    intent?: string;
    input?: string;
    kind?: string;
    subjectKind?: string;
    subjectId?: string;
    approvalToken?: string;
    allowUnpricedCost?: boolean;
    simulate?: boolean;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [action, nested] = options.input;
  const service = createProjectDataService();

  if (action === 'context') {
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    const target = requiredFlag(options.flags.target, '--target');
    writeJson(
      options.io,
      await service.buildMediaGenerationContext({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        purpose: parseGenerationPurpose(purpose),
        target: parseGenerationTarget({
          purpose,
          target,
          shotListId: options.flags.shotList,
          shots: options.flags.shots,
          productionGroupId: options.flags.productionGroup,
        }),
        shotListId: options.flags.shotList,
        shotIds: options.flags.shots ? parseShots(options.flags.shots) : undefined,
      })
    );
    return 0;
  }

  if (action === 'model' && nested === 'list') {
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    const target = requiredFlag(options.flags.target, '--target');
    writeJson(
      options.io,
      await service.listMediaGenerationModels({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        purpose: parseGenerationPurpose(purpose),
        target: parseGenerationTarget({
          purpose,
          target,
          shotListId: options.flags.shotList,
          shots: options.flags.shots,
          productionGroupId: options.flags.productionGroup,
        }),
        shotListId: options.flags.shotList,
        shotIds: options.flags.shots ? parseShots(options.flags.shots) : undefined,
        intentId: options.flags.intent,
      })
    );
    return 0;
  }

  if (action === 'production' && nested === 'update') {
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    if (purpose !== 'shot.video-take') {
      unsupportedGenerationPurpose(purpose);
    }
    const target = requiredFlag(options.flags.target, '--target');
    const production = await readJsonFile(requiredFlag(options.flags.file, '--file'));
    writeJson(
      options.io,
      await service.updateShotVideoTakeProductionGroup({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        sceneId: parseSceneTarget(target),
        shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
        shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
        productionGroupId: options.flags.productionGroup,
        production: production as never,
      })
    );
    return 0;
  }

  if (action === 'preflight') {
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    if (purpose !== 'shot.video-take') {
      unsupportedGenerationPurpose(purpose);
    }
    const target = requiredFlag(options.flags.target, '--target');
    const production = options.flags.file
      ? ((await readJsonFile(options.flags.file)) as never)
      : undefined;
    writeJson(
      options.io,
      await service.previewShotVideoTakeProduction({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        sceneId: parseSceneTarget(target),
        shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
        shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
        productionGroupId: options.flags.productionGroup,
        production,
      })
    );
    return 0;
  }

  if (action === 'input' && nested === 'list') {
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    if (purpose !== 'shot.video-take') {
      unsupportedGenerationPurpose(purpose);
    }
    const target = requiredFlag(options.flags.target, '--target');
    writeJson(
      options.io,
      await service.listShotVideoTakeInputs({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        sceneId: parseSceneTarget(target),
        shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
        shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
        productionGroupId: options.flags.productionGroup,
      })
    );
    return 0;
  }

  if (action === 'input' && nested === 'select') {
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    if (purpose !== 'shot.video-take') {
      unsupportedGenerationPurpose(purpose);
    }
    const target = requiredFlag(options.flags.target, '--target');
    writeJson(
      options.io,
      await service.selectShotVideoTakeInput({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        sceneId: parseSceneTarget(target),
        shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
        shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
        productionGroupId: options.flags.productionGroup,
        inputId: requiredFlag(options.flags.input, '--input'),
      })
    );
    return 0;
  }

  if (action === 'input' && nested === 'clear') {
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    if (purpose !== 'shot.video-take') {
      unsupportedGenerationPurpose(purpose);
    }
    const target = requiredFlag(options.flags.target, '--target');
    writeJson(
      options.io,
      await service.clearShotVideoTakeInputSelection({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        sceneId: parseSceneTarget(target),
        shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
        shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
        productionGroupId: options.flags.productionGroup,
        kind: requiredFlag(options.flags.kind, '--kind') as never,
        subjectKind: requiredFlag(options.flags.subjectKind, '--subject-kind') as never,
        subjectId: requiredFlag(options.flags.subjectId, '--subject-id'),
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'validate') {
    const spec = await readSpec(requiredFlag(options.flags.file, '--file'));
    writeJson(
      options.io,
      await service.validateMediaGenerationSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        spec,
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'create') {
    const spec = await readSpec(requiredFlag(options.flags.file, '--file'));
    writeJson(
      options.io,
      await service.createMediaGenerationSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        spec,
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'update') {
    const spec = await readSpec(requiredFlag(options.flags.file, '--file'));
    writeJson(
      options.io,
      await service.updateMediaGenerationSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        specId: requiredFlag(options.flags.spec, '--spec'),
        spec,
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'show') {
    writeJson(
      options.io,
      await service.readMediaGenerationSpec({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        specId: requiredFlag(options.flags.spec, '--spec'),
      })
    );
    return 0;
  }

  if (action === 'spec' && nested === 'list') {
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    const target = requiredFlag(options.flags.target, '--target');
    writeJson(
      options.io,
      await service.listMediaGenerationSpecs({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        purpose: parseGenerationPurpose(purpose),
        target: parseGenerationTarget({
          purpose,
          target,
          shotListId: options.flags.shotList,
          shots: options.flags.shots,
          productionGroupId: options.flags.productionGroup,
        }),
        shotListId: options.flags.shotList,
        shotIds: options.flags.shots ? parseShots(options.flags.shots) : undefined,
      })
    );
    return 0;
  }

  if (action === 'estimate') {
    const specInput = {
      projectName: options.flags.project,
      homeDir: options.homeDir,
      specId: requiredFlag(options.flags.spec, '--spec'),
    };
    writeJson(
      options.io,
      await service.estimateMediaGenerationSpec(specInput)
    );
    return 0;
  }

  if (action === 'run') {
    const specInput = {
      projectName: options.flags.project,
      homeDir: options.homeDir,
      specId: requiredFlag(options.flags.spec, '--spec'),
      approvalToken: options.flags.approvalToken,
      allowUnpricedCost: options.flags.allowUnpricedCost,
      simulate: options.flags.simulate,
    };
    writeJson(
      options.io,
      await service.runMediaGenerationSpec(specInput)
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

async function readSpec(filePath: string): Promise<MediaGenerationSpec> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as MediaGenerationSpec;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
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

function parseCastTarget(value: string): string {
  const [kind, id, extra] = value.split(':');
  if (kind !== 'cast' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `Cast image generation target must use cast:<id>. Received: ${value}.`,
      suggestion: 'Use --target cast:<cast-member-id>.',
    });
  }
  return id;
}

function parseLocationTarget(value: string): string {
  const [kind, id, extra] = value.split(':');
  if (kind !== 'location' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `Location image generation target must use location:<id>. Received: ${value}.`,
      suggestion: 'Use --target location:<location-id>.',
    });
  }
  return id;
}

function parseSceneTarget(value: string): string {
  const [kind, id, extra] = value.split(':');
  if (kind !== 'scene' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `Scene storyboard sheet generation target must use scene:<id>. Received: ${value}.`,
      suggestion: 'Use --target scene:<scene-id>.',
    });
  }
  return id;
}

function parseShots(value: string): string[] {
  const shots = value
    .split(',')
    .map((shotId) => shotId.trim())
    .filter(Boolean);
  if (shots.length === 0) {
    throw new StructuredError({
      code: 'CLI030',
      message: '--shots must include at least one shot id.',
      suggestion: 'Use --shots shot_001 or --shots shot_001,shot_002.',
    });
  }
  return shots;
}

function parseGenerationPurpose(purpose: string): MediaGenerationPurpose {
  switch (purpose) {
    case 'lookbook.image':
    case 'lookbook.sheet':
    case 'cast.character-sheet':
    case 'cast.profile':
    case 'location.environment-sheet':
    case 'scene.storyboard-sheet':
    case 'shot.first-frame':
    case 'shot.last-frame':
    case 'shot.reference-sheet':
    case 'shot.multi-shot-storyboard-sheet':
    case 'shot.video-take':
      return purpose;
    default:
      return unsupportedGenerationPurpose(purpose);
  }
}

function parseGenerationTarget(input: {
  purpose: string;
  target: string;
  shotListId?: string;
  shots?: string;
  productionGroupId?: string;
}): MediaGenerationRequestTarget {
  switch (parseGenerationPurpose(input.purpose)) {
    case 'lookbook.image':
    case 'lookbook.sheet':
      return { kind: 'lookbook', id: parseLookbookTarget(input.target) };
    case 'cast.character-sheet':
    case 'cast.profile':
      return { kind: 'castMember', id: parseCastTarget(input.target) };
    case 'location.environment-sheet':
      return { kind: 'location', id: parseLocationTarget(input.target) };
    case 'scene.storyboard-sheet':
      return { kind: 'scene', id: parseSceneTarget(input.target) };
    case 'shot.first-frame':
    case 'shot.last-frame':
    case 'shot.reference-sheet':
    case 'shot.multi-shot-storyboard-sheet':
    case 'shot.video-take': {
      const sceneId = parseSceneTarget(input.target);
      const shotListId = requiredFlag(input.shotListId, '--shot-list');
      const shotIds = parseShots(requiredFlag(input.shots, '--shots'));
      return {
        kind: 'sceneShotGroup',
        ...(input.productionGroupId
          ? { id: `${sceneId}:${shotListId}:${input.productionGroupId}` }
          : {}),
        sceneId,
        shotListId,
        ...(input.productionGroupId
          ? { productionGroupId: input.productionGroupId }
          : {}),
        shotIds,
      };
    }
  }
}

function unsupportedGenerationPurpose(purpose: string): never {
  throw new StructuredError({
    code: 'CLI024',
    message: `Unsupported generation purpose: ${purpose}.`,
    suggestion:
      'Use --purpose lookbook.image, --purpose lookbook.sheet, --purpose cast.character-sheet, --purpose cast.profile, --purpose location.environment-sheet, --purpose scene.storyboard-sheet, --purpose shot.first-frame, --purpose shot.last-frame, --purpose shot.reference-sheet, --purpose shot.multi-shot-storyboard-sheet, or --purpose shot.video-take.',
  });
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
