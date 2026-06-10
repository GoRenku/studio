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
  scene?: string;
  dialogue?: string;
  take?: string;
  productionGroup?: string;
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

async function runDialogueAudioPlan(input: GenerationCommandInput): Promise<unknown> {
  const sceneId = requiredFlag(input.flags.scene, '--scene');
  const context = await input.runtime.projectDataService.readSceneDialogueAudioContext({
    ...generationProjectInput(input.runtime),
    sceneId,
  });
  return {
    scene: context.scene,
    dialogues: context.dialogues.map((dialogue) => {
      const audio = context.audioByDialogueId[dialogue.dialogueId];
      const voices = dialogue.castMemberId
        ? context.castVoicesByCastMemberId[dialogue.castMemberId] ?? []
        : [];
      const selectedVoice =
        voices.find((voice) => voice.id === audio?.castVoiceId) ??
        voices.find((voice) => voice.usable) ??
        null;
      const modelChoice = audio?.modelChoice ?? context.defaults.modelChoice;
      return {
        dialogueId: dialogue.dialogueId,
        speaker: dialogue.castMemberId
          ? context.castMemberLabels[dialogue.castMemberId] ?? dialogue.castMemberId
          : null,
        selectedCastVoiceId: selectedVoice?.id ?? null,
        selectedCastVoiceName: selectedVoice?.name ?? null,
        modelChoice,
        plainTextLength: (audio?.plainText ?? dialogue.plainText).length,
        v3TextLength: (audio?.v3Text ?? dialogue.plainText).length,
        hasV3AudioTags: /\[[^\]]+\]/.test(audio?.v3Text ?? dialogue.plainText),
        textTreatment:
          modelChoice === 'elevenlabs/eleven_v3'
            ? 'elevenlabs-v3-audio-tags'
            : 'plain-tts',
        existingTakeCount: audio?.takes.length ?? 0,
        pickedTakeId: audio?.pickedTakeId ?? null,
        diagnostics:
          dialogue.castMemberId && selectedVoice?.usable
            ? []
            : [
                {
                  code: 'CLI140',
                  severity: 'error',
                  message:
                    'This dialogue is missing a usable ElevenLabs Cast Voice/provider voice id.',
                  path: ['dialogues', dialogue.dialogueId],
                  suggestion:
                    'Ask the agent to assign a voice id before generating dialogue audio.',
                },
              ],
      };
    }),
    resourceKeys: context.resourceKeys,
  };
}

async function runDialogueAudioGenerate(input: GenerationCommandInput): Promise<unknown> {
  const sceneId = requiredFlag(input.flags.scene, '--scene');
  const approvalToken = requiredFlag(input.flags.approvalToken, '--approval-token');
  if (input.flags.all) {
    const context = await input.runtime.projectDataService.readSceneDialogueAudioContext({
      ...generationProjectInput(input.runtime),
      sceneId,
    });
    const generated = [];
    for (const dialogue of context.dialogues) {
      if (!dialogue.castMemberId) {
        continue;
      }
      const voices = context.castVoicesByCastMemberId[dialogue.castMemberId] ?? [];
      if (!voices.some((voice) => voice.usable)) {
        continue;
      }
      generated.push(
        await input.runtime.projectDataService.generateSceneDialogueAudioTake({
          ...generationProjectInput(input.runtime),
          sceneId,
          dialogueId: dialogue.dialogueId,
          setup: {},
          approvalToken,
          allowUnpricedCost: input.flags.allowUnpricedCost,
          simulate: input.flags.simulate,
        })
      );
    }
    return { generatedCount: generated.length, generated };
  }
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

async function runDialogueAudioPick(input: GenerationCommandInput): Promise<unknown> {
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
