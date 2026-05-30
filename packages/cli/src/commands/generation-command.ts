import fs from 'node:fs/promises';
import {
  createProjectDataService,
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
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    const target = requiredFlag(options.flags.target, '--target');
    writeJson(
      options.io,
      purpose === 'lookbook.image'
        ? await service.buildLookbookImageContext({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            lookbookId: parseLookbookTarget(target),
          })
        : purpose === 'cast.character-sheet'
          ? await service.buildCastCharacterSheetContext({
              projectName: options.flags.project,
              homeDir: options.homeDir,
              castMemberId: parseCastTarget(target),
            })
          : purpose === 'cast.profile'
            ? await service.buildCastProfileContext({
                projectName: options.flags.project,
                homeDir: options.homeDir,
                castMemberId: parseCastTarget(target),
              })
            : purpose === 'location.environment-sheet'
              ? await service.buildLocationEnvironmentSheetContext({
                  projectName: options.flags.project,
                  homeDir: options.homeDir,
                  locationId: parseLocationTarget(target),
                })
              : purpose === 'scene.storyboard-sheet'
                ? await service.buildSceneStoryboardSheetContext({
                    projectName: options.flags.project,
                    homeDir: options.homeDir,
                    sceneId: parseSceneTarget(target),
                    shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
                  })
            : unsupportedGenerationPurpose(purpose)
    );
    return 0;
  }

  if (action === 'model' && nested === 'list') {
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    const target = requiredFlag(options.flags.target, '--target');
    writeJson(
      options.io,
      purpose === 'lookbook.image'
        ? await service.listLookbookImageModels({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            lookbookId: parseLookbookTarget(target),
          })
        : purpose === 'cast.character-sheet'
          ? await service.listCastCharacterSheetModels({
              projectName: options.flags.project,
              homeDir: options.homeDir,
              castMemberId: parseCastTarget(target),
            })
          : purpose === 'cast.profile'
            ? await service.listCastProfileModels({
                projectName: options.flags.project,
                homeDir: options.homeDir,
                castMemberId: parseCastTarget(target),
              })
            : purpose === 'location.environment-sheet'
              ? await service.listLocationEnvironmentSheetModels({
                  projectName: options.flags.project,
                  homeDir: options.homeDir,
                  locationId: parseLocationTarget(target),
                })
              : purpose === 'scene.storyboard-sheet'
                ? await service.listSceneStoryboardSheetModels({
                    projectName: options.flags.project,
                    homeDir: options.homeDir,
                    sceneId: parseSceneTarget(target),
                    shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
                  })
            : unsupportedGenerationPurpose(purpose)
    );
    return 0;
  }

  if (action === 'spec' && nested === 'validate') {
    const spec = await readSpec(requiredFlag(options.flags.file, '--file'));
    const specPurpose = spec.purpose as string;
    writeJson(
      options.io,
      spec.purpose === 'lookbook.image'
        ? await service.validateLookbookImageSpec({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            spec,
          })
        : spec.purpose === 'cast.character-sheet'
          ? await service.validateCastCharacterSheetSpec({
              projectName: options.flags.project,
              homeDir: options.homeDir,
              spec,
            })
          : spec.purpose === 'cast.profile'
            ? await service.validateCastProfileSpec({
                projectName: options.flags.project,
                homeDir: options.homeDir,
                spec,
              })
            : spec.purpose === 'location.environment-sheet'
              ? await service.validateLocationEnvironmentSheetSpec({
                  projectName: options.flags.project,
                  homeDir: options.homeDir,
                  spec,
                })
              : spec.purpose === 'scene.storyboard-sheet'
                ? await service.validateSceneStoryboardSheetSpec({
                    projectName: options.flags.project,
                    homeDir: options.homeDir,
                    spec,
                  })
            : unsupportedGenerationPurpose(specPurpose)
    );
    return 0;
  }

  if (action === 'spec' && nested === 'create') {
    const spec = await readSpec(requiredFlag(options.flags.file, '--file'));
    const specPurpose = spec.purpose as string;
    writeJson(
      options.io,
      spec.purpose === 'lookbook.image'
        ? await service.createLookbookImageSpec({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            spec,
          })
        : spec.purpose === 'cast.character-sheet'
          ? await service.createCastCharacterSheetSpec({
              projectName: options.flags.project,
              homeDir: options.homeDir,
              spec,
            })
          : spec.purpose === 'cast.profile'
            ? await service.createCastProfileSpec({
                projectName: options.flags.project,
                homeDir: options.homeDir,
                spec,
              })
            : spec.purpose === 'location.environment-sheet'
              ? await service.createLocationEnvironmentSheetSpec({
                  projectName: options.flags.project,
                  homeDir: options.homeDir,
                  spec,
                })
              : spec.purpose === 'scene.storyboard-sheet'
                ? await service.createSceneStoryboardSheetSpec({
                    projectName: options.flags.project,
                    homeDir: options.homeDir,
                    spec,
                  })
            : unsupportedGenerationPurpose(specPurpose)
    );
    return 0;
  }

  if (action === 'spec' && nested === 'update') {
    const spec = await readSpec(requiredFlag(options.flags.file, '--file'));
    const specPurpose = spec.purpose as string;
    writeJson(
      options.io,
      spec.purpose === 'lookbook.image'
        ? await service.updateLookbookImageSpec({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            specId: requiredFlag(options.flags.spec, '--spec'),
            spec,
          })
        : spec.purpose === 'cast.character-sheet'
          ? await service.updateCastCharacterSheetSpec({
              projectName: options.flags.project,
              homeDir: options.homeDir,
              specId: requiredFlag(options.flags.spec, '--spec'),
              spec,
            })
          : spec.purpose === 'cast.profile'
            ? await service.updateCastProfileSpec({
                projectName: options.flags.project,
                homeDir: options.homeDir,
                specId: requiredFlag(options.flags.spec, '--spec'),
                spec,
              })
            : spec.purpose === 'location.environment-sheet'
              ? await service.updateLocationEnvironmentSheetSpec({
                  projectName: options.flags.project,
                  homeDir: options.homeDir,
                  specId: requiredFlag(options.flags.spec, '--spec'),
                  spec,
                })
              : spec.purpose === 'scene.storyboard-sheet'
                ? await service.updateSceneStoryboardSheetSpec({
                    projectName: options.flags.project,
                    homeDir: options.homeDir,
                    specId: requiredFlag(options.flags.spec, '--spec'),
                    spec,
                  })
            : unsupportedGenerationPurpose(specPurpose)
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
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    const target = requiredFlag(options.flags.target, '--target');
    writeJson(
      options.io,
      purpose === 'lookbook.image'
        ? await service.listLookbookImageSpecs({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            lookbookId: parseLookbookTarget(target),
          })
        : purpose === 'cast.character-sheet'
          ? await service.listCastCharacterSheetSpecs({
              projectName: options.flags.project,
              homeDir: options.homeDir,
              castMemberId: parseCastTarget(target),
            })
          : purpose === 'cast.profile'
            ? await service.listCastProfileSpecs({
                projectName: options.flags.project,
                homeDir: options.homeDir,
                castMemberId: parseCastTarget(target),
              })
            : purpose === 'location.environment-sheet'
              ? await service.listLocationEnvironmentSheetSpecs({
                  projectName: options.flags.project,
                  homeDir: options.homeDir,
                  locationId: parseLocationTarget(target),
                })
              : purpose === 'scene.storyboard-sheet'
                ? await service.listSceneStoryboardSheetSpecs({
                    projectName: options.flags.project,
                    homeDir: options.homeDir,
                    sceneId: parseSceneTarget(target),
                    shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
                  })
            : unsupportedGenerationPurpose(purpose)
    );
    return 0;
  }

  if (action === 'estimate') {
    const specInput = {
      projectName: options.flags.project,
      homeDir: options.homeDir,
      specId: requiredFlag(options.flags.spec, '--spec'),
    };
    const specRecord = await service.readLookbookImageSpec(specInput);
    const specPurpose = specRecord.spec.purpose as string;
    writeJson(
      options.io,
      specRecord.spec.purpose === 'lookbook.image'
        ? await service.estimateLookbookImageSpec(specInput)
        : specRecord.spec.purpose === 'cast.character-sheet'
          ? await service.estimateCastCharacterSheetSpec(specInput)
          : specRecord.spec.purpose === 'cast.profile'
            ? await service.estimateCastProfileSpec(specInput)
            : specRecord.spec.purpose === 'location.environment-sheet'
              ? await service.estimateLocationEnvironmentSheetSpec(specInput)
              : specRecord.spec.purpose === 'scene.storyboard-sheet'
                ? await service.estimateSceneStoryboardSheetSpec(specInput)
            : unsupportedGenerationPurpose(specPurpose)
    );
    return 0;
  }

  if (action === 'run') {
    const specInput = {
      projectName: options.flags.project,
      homeDir: options.homeDir,
      specId: requiredFlag(options.flags.spec, '--spec'),
      approvalToken: options.flags.approvalToken,
      simulate: options.flags.simulate,
    };
    const specRecord = await service.readLookbookImageSpec(specInput);
    const specPurpose = specRecord.spec.purpose as string;
    writeJson(
      options.io,
      specRecord.spec.purpose === 'lookbook.image'
        ? await service.runLookbookImageSpec(specInput)
        : specRecord.spec.purpose === 'cast.character-sheet'
          ? await service.runCastCharacterSheetSpec(specInput)
          : specRecord.spec.purpose === 'cast.profile'
            ? await service.runCastProfileSpec(specInput)
            : specRecord.spec.purpose === 'location.environment-sheet'
              ? await service.runLocationEnvironmentSheetSpec(specInput)
              : specRecord.spec.purpose === 'scene.storyboard-sheet'
                ? await service.runSceneStoryboardSheetSpec(specInput)
            : unsupportedGenerationPurpose(specPurpose)
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

function unsupportedGenerationPurpose(purpose: string): never {
  throw new StructuredError({
    code: 'CLI024',
    message: `Unsupported generation purpose: ${purpose}.`,
    suggestion:
      'Use --purpose lookbook.image, --purpose cast.character-sheet, --purpose cast.profile, --purpose location.environment-sheet, or --purpose scene.storyboard-sheet.',
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
