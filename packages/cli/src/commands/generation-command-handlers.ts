import { type MediaGenerationSpec } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
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
  approvalToken?: string;
  allowUnpricedCost?: boolean;
  simulate?: boolean;
  all?: boolean;
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
    path: ['dialogue-audio', 'pick'],
    run: runDialogueAudioPick,
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
    readGenerationContextInput(input),
  );
}

async function runModelList(input: GenerationCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.listMediaGenerationModels({
    ...readGenerationContextInput(input),
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
    readShotVideoContextInput(input),
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
    subjectKind: requiredFlag(
      input.flags.subjectKind,
      '--subject-kind',
    ) as never,
    subjectId: requiredFlag(input.flags.subjectId, '--subject-id'),
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
    readGenerationContextInput(input),
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
    pickedTakeId: audio?.pickedTakeId ?? null,
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
  if (input.flags.all) {
    return runAllDialogueAudioGenerate(input, sceneId);
  }
  const approvalToken = input.flags.simulate
    ? input.flags.approvalToken
    : requiredFlag(input.flags.approvalToken, '--approval-token');
  return input.runtime.projectDataService.generateSceneDialogueAudioTake({
    ...generationProjectInput(input.runtime),
    sceneId,
    dialogueId: requiredFlag(input.flags.dialogue, '--dialogue'),
    setup: {},
    approvalToken,
    allowUnpricedCost: input.flags.allowUnpricedCost,
    simulate: input.flags.simulate,
  });
}

async function runAllDialogueAudioGenerate(
  input: GenerationCommandInput,
  sceneId: string
): Promise<unknown> {
  assertDialogueAudioBulkGenerateIsSimulated(input);
  const context =
    await input.runtime.projectDataService.readSceneDialogueAudioContext({
      ...generationProjectInput(input.runtime),
      sceneId,
    });
  const generated = [];
  for (const dialogue of context.dialogues) {
    if (!canBulkGenerateDialogue(context, dialogue)) {
      continue;
    }
    generated.push(
      await input.runtime.projectDataService.generateSceneDialogueAudioTake({
        ...generationProjectInput(input.runtime),
        sceneId,
        dialogueId: dialogue.dialogueId,
        setup: {},
        approvalToken: input.flags.approvalToken,
        allowUnpricedCost: input.flags.allowUnpricedCost,
        simulate: input.flags.simulate,
      })
    );
  }
  return { generatedCount: generated.length, generated };
}

function assertDialogueAudioBulkGenerateIsSimulated(
  input: GenerationCommandInput
): void {
  if (input.flags.simulate) {
    return;
  }
  throw new StructuredError({
    code: 'CLI141',
    message:
      'generation dialogue-audio generate --all cannot use one approval token for multiple live dialogue generations.',
    suggestion:
      'Run generation dialogue-audio plan, then generate each dialogue separately with the approval token for that exact dialogue request, or add --simulate for a bulk dry run.',
  });
}

function canBulkGenerateDialogue(
  context: SceneDialogueAudioPlanContext,
  dialogue: SceneDialogueAudioPlanDialogue
): boolean {
  if (!dialogue.castMemberId) {
    return false;
  }
  const voices = context.castVoicesByCastMemberId[dialogue.castMemberId] ?? [];
  return voices.some((voice) => voice.usable);
}

async function runDialogueAudioPick(
  input: GenerationCommandInput,
): Promise<unknown> {
  return input.runtime.projectDataService.pickSceneDialogueAudioTake({
    ...generationProjectInput(input.runtime),
    sceneId: requiredFlag(input.flags.scene, '--scene'),
    dialogueId: requiredFlag(input.flags.dialogue, '--dialogue'),
    takeId: requiredFlag(input.flags.take, '--take'),
  });
}

type GenerationCommandInput = Parameters<
  CliCommandHandler<GenerationCommandFlags>['run']
>[0];

function readGenerationContextInput(input: GenerationCommandInput) {
  const purpose = requiredFlag(input.flags.purpose, '--purpose');
  const target = requiredFlag(input.flags.target, '--target');
  const parsedTarget = parseGenerationTarget({
    purpose,
    target,
    shots: input.flags.shots,
    takeId: input.flags.take,
  });
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

function readShotVideoContextInput(input: GenerationCommandInput) {
  const target = requiredFlag(input.flags.target, '--target');
  return {
    ...generationProjectInput(input.runtime),
    sceneId: parseSceneTarget(target, 'Shot Video Take'),
    takeId: requiredFlag(input.flags.take, '--take'),
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
