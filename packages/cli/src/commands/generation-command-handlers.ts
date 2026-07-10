import {
  validateGenerationPreviewRequest,
  resolveRenkuStorageRoot,
  type MediaGenerationRequestTarget,
  type MediaGenerationSpec,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { notifyStudioGenerationPreview } from './studio-notification-client.js';
import {
  assertShotVideoTakePurpose,
  parseGenerationPurpose,
  parseGenerationTarget,
} from './generation-purpose-command-registry.js';
import { parseSceneTarget, parseShots } from './studio-target-parsing.js';
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
  run?: string;
  shotList?: string;
  shots?: string;
  scene?: string;
  dialogue?: string;
  take?: string;
  intent?: string;
  input?: string;
  kind?: string;
  subjectKind?: string;
  subjectId?: string;
  approveLiveProviderRun?: boolean;
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
    path: ['dialogue-audio', 'plan'],
    run: runDialogueAudioPlan,
  },
  {
    path: ['dialogue-audio', 'generate'],
    run: runDialogueAudioGenerate,
  },
  {
    path: ['preview', 'show'],
    run: runPreviewShow,
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
    path: ['input', 'delete'],
    run: runInputDelete,
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
    path: ['run', 'show'],
    run: runGenerationShow,
  },
  {
    path: ['run'],
    run: runGeneration,
  },
] satisfies CliCommandHandler<GenerationCommandFlags>[];

async function runContext(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.buildMediaGenerationContext(
    await readGenerationContextInput(input),
  );
}

async function runModelList(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.listMediaGenerationModels({
    ...(await readGenerationContextInput(input)),
    inputModeId: input.flags.intent,
  });
}

async function runProductionUpdate(
  input: GenerationCommandInput,
): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  const production = await readJsonFile(
    requiredFlag(input.flags.file, '--file'),
  );
  return input.runtime.projectDataService.updateSceneShotVideoTakeProduction({
    ...(await readShotVideoContextInput(input)),
    production: production as never,
  });
}

async function runPreflight(input: GenerationCommandInput): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  const production = input.flags.file
    ? ((await readJsonFile(input.flags.file)) as never)
    : undefined;
  return input.runtime.projectDataService.previewShotVideoTakeProduction({
    ...(await readShotVideoContextInput(input)),
    production,
  });
}

async function runInputList(input: GenerationCommandInput): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  return input.runtime.projectDataService.listShotVideoTakeInputs(
    await readShotVideoContextInput(input),
  );
}

async function runPreviewShow(input: GenerationCommandInput): Promise<unknown> {
  const preview = await readPreviewShowRequest(input);
  const project = await input.runtime.projectDataService.readProject({
    projectName: preview.project.name,
    homeDir: input.runtime.homeDir,
  });
  if (
    project.identity.id !== preview.project.id ||
    project.identity.name !== preview.project.name
  ) {
    throw new StructuredError({
      code: 'CLI143',
      message:
        'Generation preview project identity does not match the resolved project.',
      suggestion:
        'Regenerate the preview from the current project context before showing it in Studio.',
    });
  }
  const delivery = await notifyStudioGenerationPreview({
    homeDir: input.runtime.homeDir,
    notification: {
      projectRef: {
        name: project.identity.name,
        id: project.identity.id,
        storageRoot: await resolveRenkuStorageRoot({
          homeDir: input.runtime.homeDir,
        }),
      },
      preview,
      source: { kind: 'cli', command: 'generation preview show' },
    },
  });
  if (delivery.status !== 'delivered') {
    throw generationPreviewDeliveryError(delivery);
  }
  return {
    valid: true,
    previewId: preview.previewId,
    purpose: preview.purpose,
    project: {
      id: preview.project.id,
      name: preview.project.name,
    },
    studio: {
      delivery: 'delivered',
    },
  };
}

async function readPreviewShowRequest(input: GenerationCommandInput) {
  if (input.flags.file && input.flags.spec) {
    throw new StructuredError({
      code: 'CLI145',
      message: 'generation preview show accepts either --file or --spec, not both.',
      suggestion:
        'Use --file for a draft media generation spec or --spec for a saved media generation spec.',
    });
  }
  if (input.flags.spec) {
    return validateGenerationPreviewRequest(
      await input.runtime.projectDataService.buildMediaGenerationPreview({
        projectName: input.runtime.projectName,
        homeDir: input.runtime.homeDir,
        specId: input.flags.spec,
      })
    );
  }
  const spec = (await readJsonFile(
    requiredFlag(input.flags.file, '--file')
  )) as MediaGenerationSpec;
  return validateGenerationPreviewRequest(
    await input.runtime.projectDataService.buildDraftMediaGenerationPreview({
      projectName: input.runtime.projectName,
      homeDir: input.runtime.homeDir,
      spec,
    })
  );
}

async function runInputSelect(input: GenerationCommandInput): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  return input.runtime.projectDataService.selectShotVideoTakeInput({
    ...(await readShotVideoContextInput(input)),
    inputId: requiredFlag(input.flags.input, '--input'),
  });
}

async function runInputClear(input: GenerationCommandInput): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  return input.runtime.projectDataService.clearShotVideoTakeInputSelection({
    ...(await readShotVideoContextInput(input)),
    kind: requiredFlag(input.flags.kind, '--kind') as never,
    subjectKind: requiredFlag(
      input.flags.subjectKind,
      '--subject-kind',
    ) as never,
    subjectId: requiredFlag(input.flags.subjectId, '--subject-id'),
  });
}

async function runInputDelete(input: GenerationCommandInput): Promise<unknown> {
  assertShotVideoPurpose(input.flags);
  return input.runtime.projectDataService.deleteShotVideoTakeInput({
    ...(await readShotVideoContextInput(input)),
    inputId: requiredFlag(input.flags.input, '--input'),
  });
}

async function runSpecValidate(
  input: GenerationCommandInput,
): Promise<unknown> {
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
    await readGenerationContextInput(input),
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
    approveLiveProviderRun: input.flags.approveLiveProviderRun,
    simulate: input.flags.simulate,
  });
}

async function runGenerationShow(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.readMediaGenerationRun({
    ...generationProjectInput(input.runtime),
    runId: requiredFlag(input.flags.run, '--run'),
  });
}

async function runDialogueAudioPlan(
  input: GenerationCommandInput,
): Promise<unknown> {
  const sceneId = requiredFlag(input.flags.scene, '--scene');
  const context =
    await input.runtime.projectDataService.readSceneDialogueAudioContext({
      ...generationProjectInput(input.runtime),
      sceneId,
    });
  return {
    scene: context.scene,
    dialogues: context.dialogues.map((dialogue) =>
      dialogueAudioPlanItem(context, dialogue)
    ),
    resourceKeys: context.resourceKeys,
  };
}

type SceneDialogueAudioPlanContext = Awaited<
  ReturnType<CliCommandRuntime['projectDataService']['readSceneDialogueAudioContext']>
>;

type SceneDialogueAudioPlanDialogue =
  SceneDialogueAudioPlanContext['dialogues'][number];

function dialogueAudioPlanItem(
  context: SceneDialogueAudioPlanContext,
  dialogue: SceneDialogueAudioPlanDialogue
) {
  const audio = context.audioByDialogueId[dialogue.dialogueId];
  const selectedVoice = selectedDialogueVoice(context, dialogue, audio?.castVoiceId);
  const modelChoice = audio?.modelChoice ?? context.defaults.modelChoice;
  const plainText = audio?.plainText ?? dialogue.plainText;
  const v3Text = audio?.v3Text ?? dialogue.plainText;
  return {
    dialogueId: dialogue.dialogueId,
    speaker: dialogueSpeakerLabel(context, dialogue),
    selectedCastVoiceId: selectedVoice?.id ?? null,
    selectedCastVoiceName: selectedVoice?.name ?? null,
    modelChoice,
    plainTextLength: plainText.length,
    v3TextLength: v3Text.length,
    hasV3AudioTags: /\[[^\]]+\]/.test(v3Text),
    textTreatment: dialogueTextTreatment(modelChoice),
    existingTakeCount: audio?.takes.length ?? 0,
    diagnostics: dialogueAudioPlanDiagnostics(dialogue, selectedVoice?.usable),
  };
}

function dialogueTextTreatment(modelChoice: string): string {
  return modelChoice === 'elevenlabs/eleven_v3'
    ? 'elevenlabs-v3-audio-tags'
    : 'plain-tts';
}

function selectedDialogueVoice(
  context: SceneDialogueAudioPlanContext,
  dialogue: SceneDialogueAudioPlanDialogue,
  castVoiceId: string | null | undefined
) {
  const voices = dialogue.castMemberId
    ? (context.castVoicesByCastMemberId[dialogue.castMemberId] ?? [])
    : [];
  return (
    voices.find((voice) => voice.id === castVoiceId) ??
    voices.find((voice) => voice.usable) ??
    null
  );
}

function dialogueSpeakerLabel(
  context: SceneDialogueAudioPlanContext,
  dialogue: SceneDialogueAudioPlanDialogue
): string | null {
  if (!dialogue.castMemberId) {
    return null;
  }
  return context.castMemberLabels[dialogue.castMemberId] ?? dialogue.castMemberId;
}

function dialogueAudioPlanDiagnostics(
  dialogue: SceneDialogueAudioPlanDialogue,
  hasUsableVoice: boolean | undefined
) {
  if (dialogue.castMemberId && hasUsableVoice) {
    return [];
  }
  return [
    {
      code: 'CLI140',
      severity: 'error',
      message:
        'This dialogue is missing a usable ElevenLabs Cast Voice/provider voice id.',
      path: ['dialogues', dialogue.dialogueId],
      suggestion:
        'Ask the agent to assign a voice id before generating dialogue audio.',
    },
  ];
}

async function runDialogueAudioGenerate(
  input: GenerationCommandInput,
): Promise<unknown> {
  const sceneId = requiredFlag(input.flags.scene, '--scene');
  return input.runtime.projectDataService.generateSceneDialogueAudioTake({
    ...generationProjectInput(input.runtime),
    sceneId,
    dialogueId: requiredFlag(input.flags.dialogue, '--dialogue'),
    setup: {},
    approveLiveProviderRun: input.flags.approveLiveProviderRun,
    simulate: input.flags.simulate,
  });
}

type GenerationCommandInput = Parameters<
  CliCommandHandler<GenerationCommandFlags>['run']
>[0];

async function readGenerationContextInput(input: GenerationCommandInput) {
  const purpose = requiredFlag(input.flags.purpose, '--purpose');
  const target = requiredFlag(input.flags.target, '--target');
  const parsedTarget = await resolveGenerationTarget(input, purpose, target);
  return {
    ...generationProjectInput(input.runtime),
    purpose: parseGenerationPurpose(purpose),
    target: parsedTarget,
    shotListId: input.flags.shotList,
    shotIds:
      parsedTarget.kind === 'sceneShotVideoTake' || !input.flags.shots
        ? undefined
        : parseShots(input.flags.shots),
  };
}

async function resolveGenerationTarget(
  input: GenerationCommandInput,
  purpose: string,
  target: string
): Promise<MediaGenerationRequestTarget> {
  const takeId = parseTakeTarget(target);
  if (!takeId) {
    return parseGenerationTarget({
      purpose,
      target,
      shots: input.flags.shots,
      takeId: input.flags.take,
    });
  }
  assertTakeTargetMatchesFlag({ targetTakeId: takeId, flagTakeId: input.flags.take });
  const take = await input.runtime.projectDataService.readSceneShotVideoTake({
    ...generationProjectInput(input.runtime),
    takeId,
  });
  return {
    kind: 'sceneShotVideoTake',
    id: take.takeId,
    sceneId: take.sceneId,
    takeId: take.takeId,
  };
}

async function readShotVideoContextInput(input: GenerationCommandInput) {
  const target = requiredFlag(input.flags.target, '--target');
  const takeId = parseTakeTarget(target);
  if (takeId) {
    assertTakeTargetMatchesFlag({ targetTakeId: takeId, flagTakeId: input.flags.take });
    const take = await input.runtime.projectDataService.readSceneShotVideoTake({
      ...generationProjectInput(input.runtime),
      takeId,
    });
    return {
      ...generationProjectInput(input.runtime),
      sceneId: take.sceneId,
      takeId: take.takeId,
    };
  }
  return {
    ...generationProjectInput(input.runtime),
    sceneId: parseSceneTarget(target, 'Shot Video Take'),
    takeId: requiredFlag(input.flags.take, '--take'),
  };
}

function parseTakeTarget(value: string): string | null {
  const [kind, id, extra] = value.split(':');
  if (kind !== 'take') {
    return null;
  }
  if (!id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI141',
      message: `Shot Video Take target must use take:<take-id>. Received: ${value}.`,
      suggestion: 'Use --target take:<take-id>.',
    });
  }
  return id;
}

function assertTakeTargetMatchesFlag(input: {
  targetTakeId: string;
  flagTakeId?: string;
}): void {
  if (input.flagTakeId && input.flagTakeId !== input.targetTakeId) {
    throw new StructuredError({
      code: 'CLI142',
      message: `--target take:${input.targetTakeId} conflicts with --take ${input.flagTakeId}.`,
      suggestion:
        'Omit --take when using --target take:<take-id>, or pass the same take id in both flags.',
    });
  }
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

function generationPreviewDeliveryError(delivery: Exclude<Awaited<ReturnType<typeof notifyStudioGenerationPreview>>, { status: 'delivered' }>): StructuredError {
  if (delivery.status === 'notRunning') {
    return new StructuredError({
      code: 'CLI144',
      message:
        'Studio is not running, so the Generation Preview Dialog cannot be shown.',
      suggestion:
        'Start Renku Studio, then run generation preview show again with the same spec file or saved spec id.',
    });
  }
  if (delivery.status === 'notConfigured') {
    return new StructuredError({
      code: 'CLI145',
      message:
        'The running Studio runtime is missing its local notification token.',
      suggestion:
        'Restart Studio so CLI preview notifications can be delivered.',
    });
  }
  return new StructuredError({
    code: 'CLI146',
    message: 'Generation preview could not be delivered to Studio.',
    suggestion:
      'Check that Studio is still running and reachable on its local server URL.',
    issues: [
      {
        code: 'CLI146',
        severity: 'error',
        message: delivery.detail,
        location: { path: ['studio'], context: 'generation preview delivery' },
      },
    ],
  });
}
