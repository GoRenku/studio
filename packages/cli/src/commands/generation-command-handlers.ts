import {
  type MediaGenerationSpec,
} from '@gorenku/studio-core/server';
import {
  assertShotVideoTakePurpose,
  parseGenerationPurpose,
  parseGenerationTarget,
} from './generation-purpose-command-registry.js';
import {
  parseSceneTarget,
  parseShots,
} from './studio-target-parsing.js';
import {
  readJsonFile,
  requiredFlag,
  type CliCommandHandler,
  type CliCommandRuntime,
} from './structured-command.js';

export interface GenerationCommandFlags {
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
}

export const generationCommandHandlers = [
  {
    path: ['context'],
    run: runContext,
  },
  {
    path: ['model', 'list'],
    run: runModelList,
  },
  {
    path: ['production', 'update'],
    run: runProductionUpdate,
  },
  {
    path: ['preflight'],
    run: runPreflight,
  },
  {
    path: ['input', 'list'],
    run: runInputList,
  },
  {
    path: ['input', 'select'],
    run: runInputSelect,
  },
  {
    path: ['input', 'clear'],
    run: runInputClear,
  },
  {
    path: ['spec', 'validate'],
    run: runSpecValidate,
  },
  {
    path: ['spec', 'create'],
    run: runSpecCreate,
  },
  {
    path: ['spec', 'update'],
    run: runSpecUpdate,
  },
  {
    path: ['spec', 'show'],
    run: runSpecShow,
  },
  {
    path: ['spec', 'list'],
    run: runSpecList,
  },
  {
    path: ['estimate'],
    run: runEstimate,
  },
  {
    path: ['run'],
    run: runGeneration,
  },
] satisfies CliCommandHandler<GenerationCommandFlags>[];

async function runContext(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.buildMediaGenerationContext(
    readGenerationContextInput(input)
  );
}

async function runModelList(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.listMediaGenerationModels({
    ...readGenerationContextInput(input),
    inputModeId: input.flags.intent,
  });
}

async function runProductionUpdate(
  input: GenerationCommandInput
): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  const production = await readJsonFile(requiredFlag(input.flags.file, '--file'));
  return input.runtime.projectDataService.updateShotVideoTakeProductionGroup({
    ...readShotVideoContextInput(input),
    production: production as never,
  });
}

async function runPreflight(input: GenerationCommandInput): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  const production = input.flags.file
    ? ((await readJsonFile(input.flags.file)) as never)
    : undefined;
  return input.runtime.projectDataService.previewShotVideoTakeProduction({
    ...readShotVideoContextInput(input),
    production,
  });
}

async function runInputList(input: GenerationCommandInput): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  return input.runtime.projectDataService.listShotVideoTakeInputs(
    readShotVideoContextInput(input)
  );
}

async function runInputSelect(input: GenerationCommandInput): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  return input.runtime.projectDataService.selectShotVideoTakeInput({
    ...readShotVideoContextInput(input),
    inputId: requiredFlag(input.flags.input, '--input'),
  });
}

async function runInputClear(input: GenerationCommandInput): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  return input.runtime.projectDataService.clearShotVideoTakeInputSelection({
    ...readShotVideoContextInput(input),
    kind: requiredFlag(input.flags.kind, '--kind') as never,
    subjectKind: requiredFlag(input.flags.subjectKind, '--subject-kind') as never,
    subjectId: requiredFlag(input.flags.subjectId, '--subject-id'),
  });
}

async function runSpecValidate(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.validateMediaGenerationSpec({
    ...generationProjectInput(input.runtime),
    spec: await readSpec(requiredFlag(input.flags.file, '--file')),
  });
}

async function runSpecCreate(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.createMediaGenerationSpec({
    ...generationProjectInput(input.runtime),
    spec: await readSpec(requiredFlag(input.flags.file, '--file')),
  });
}

async function runSpecUpdate(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.updateMediaGenerationSpec({
    ...generationProjectInput(input.runtime),
    specId: requiredFlag(input.flags.spec, '--spec'),
    spec: await readSpec(requiredFlag(input.flags.file, '--file')),
  });
}

async function runSpecShow(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.readMediaGenerationSpec({
    ...generationProjectInput(input.runtime),
    specId: requiredFlag(input.flags.spec, '--spec'),
  });
}

async function runSpecList(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.listMediaGenerationSpecs(
    readGenerationContextInput(input)
  );
}

async function runEstimate(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.estimateMediaGenerationSpec({
    ...generationProjectInput(input.runtime),
    specId: requiredFlag(input.flags.spec, '--spec'),
  });
}

async function runGeneration(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.runMediaGenerationSpec({
    ...generationProjectInput(input.runtime),
    specId: requiredFlag(input.flags.spec, '--spec'),
    approvalToken: input.flags.approvalToken,
    allowUnpricedCost: input.flags.allowUnpricedCost,
    simulate: input.flags.simulate,
  });
}

type GenerationCommandInput = Parameters<
  CliCommandHandler<GenerationCommandFlags>['run']
>[0];

function readGenerationContextInput(input: GenerationCommandInput) {
  const purpose = requiredFlag(input.flags.purpose, '--purpose');
  const target = requiredFlag(input.flags.target, '--target');
  return {
    ...generationProjectInput(input.runtime),
    purpose: parseGenerationPurpose(purpose),
    target: parseGenerationTarget({
      purpose,
      target,
      shotListId: input.flags.shotList,
      shots: input.flags.shots,
      productionGroupId: input.flags.productionGroup,
    }),
    shotListId: input.flags.shotList,
    shotIds: input.flags.shots ? parseShots(input.flags.shots) : undefined,
  };
}

function readShotVideoContextInput(input: GenerationCommandInput) {
  const target = requiredFlag(input.flags.target, '--target');
  return {
    ...generationProjectInput(input.runtime),
    sceneId: parseSceneTarget(target, 'Shot video take generation'),
    shotListId: requiredFlag(input.flags.shotList, '--shot-list'),
    shotIds: parseShots(requiredFlag(input.flags.shots, '--shots')),
    productionGroupId: input.flags.productionGroup,
  };
}

async function readSpec(filePath: string): Promise<MediaGenerationSpec> {
  return (await readJsonFile(filePath)) as MediaGenerationSpec;
}

function assertShotVideoPurpose(flags: GenerationCommandFlags): void {
  assertShotVideoTakePurpose(requiredFlag(flags.purpose, '--purpose'));
}

function generationProjectInput(runtime: CliCommandRuntime): {
  projectName?: string;
  homeDir?: string;
} {
  return {
    projectName: runtime.projectName,
    homeDir: runtime.homeDir,
  };
}
