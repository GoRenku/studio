import {
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  type MediaGenerationCostEstimate,
  type MediaGenerationDependencyPricing,
  type SceneDialogueAudioGenerationSpec,
  type SceneDialogueAudioModelChoice,
} from '../../../client/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { readSceneDialogueAudioRecord } from '../../database/access/scene-dialogue-audio.js';
import { readScreenplaySceneFromSession } from '../../database/access/screenplay-resource.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  DEFAULT_SCENE_DIALOGUE_AUDIO_MODEL_CHOICE,
  DEFAULT_SCENE_DIALOGUE_AUDIO_OUTPUT_FORMAT,
  DEFAULT_SCENE_DIALOGUE_AUDIO_VOICE_SETTINGS,
  MISSING_SCENE_DIALOGUE_AUDIO_CAST_VOICE_REASON,
  SCENE_DIALOGUE_AUDIO_MODEL_CHOICES,
  sceneDialogueAudioTextTreatmentForModel,
} from '../purposes/scene-dialogue-audio-config.js';
import {
  buildMediaGenerationCostProjection,
  mediaGenerationCostEstimateToPricing,
} from '../cost/cost-projection.js';
import {
  withMediaGenerationEstimationProjectSession,
} from './project-session.js';

export async function estimateSceneDialogueAudioPricingOnly(input: {
  projectName?: string;
  homeDir?: string;
  sceneId: string;
  dialogueId: string;
  setup: Partial<SceneDialogueAudioGenerationSpec>;
}): Promise<{
  pricing: MediaGenerationDependencyPricing;
  estimate: MediaGenerationCostEstimate | null;
  diagnostics: DiagnosticIssue[];
}> {
  const pricingInput = await sceneDialogueAudioPricingInput(input);
  const estimate = (
    await buildMediaGenerationCostProjection({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec: {
        purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
        target: {
          kind: 'sceneDialogue',
          sceneId: input.sceneId,
          dialogueId: input.dialogueId,
        },
        modelChoice: pricingInput.modelChoice,
        castVoiceId: input.setup.castVoiceId ?? '',
        plainText: pricingInput.providerText,
        v3Text: pricingInput.providerText,
        voiceSettings: DEFAULT_SCENE_DIALOGUE_AUDIO_VOICE_SETTINGS,
        outputFormat: pricingInput.outputFormat,
        languageCode: pricingInput.languageCode,
        title: input.setup.title,
      },
    })
  ).estimate;
  return {
    pricing: mediaGenerationCostEstimateToPricing(estimate),
    estimate,
    diagnostics: [
      createDiagnosticWarning(
        'CORE_SCENE_DIALOGUE_AUDIO_MISSING_CAST_VOICE',
        MISSING_SCENE_DIALOGUE_AUDIO_CAST_VOICE_REASON,
        { path: ['sceneDialogueAudio', input.dialogueId, 'castVoiceId'] },
        MISSING_SCENE_DIALOGUE_AUDIO_CAST_VOICE_REASON
      ),
    ],
  };
}

async function sceneDialogueAudioPricingInput(input: {
  projectName?: string;
  homeDir?: string;
  sceneId: string;
  dialogueId: string;
  setup: Partial<SceneDialogueAudioGenerationSpec>;
}): Promise<{
  modelChoice: SceneDialogueAudioModelChoice;
  providerText: string;
  outputFormat: string;
  languageCode: string | null;
}> {
  return withMediaGenerationEstimationProjectSession(input, ({ session }) => {
    const existing = readSceneDialogueAudioRecord(session, {
      sceneId: input.sceneId,
      dialogueId: input.dialogueId,
    });
    const dialogue = requireDialogueForSceneDialogueAudioEstimate({
      sceneId: input.sceneId,
      dialogueId: input.dialogueId,
      session,
    });
    const plainText =
      input.setup.plainText ?? existing?.plainText ?? dialogue.lines.join('\n');
    const modelChoice =
      input.setup.modelChoice ??
      (existing?.modelChoice as SceneDialogueAudioModelChoice | undefined) ??
      DEFAULT_SCENE_DIALOGUE_AUDIO_MODEL_CHOICE;
    if (!SCENE_DIALOGUE_AUDIO_MODEL_CHOICES.has(modelChoice)) {
      throw new ProjectDataError(
        'PROJECT_DATA385',
        `Unsupported Scene Dialogue Audio model: ${modelChoice}.`
      );
    }
    const normalizedPlainText = plainText.trim();
    const rawV3Text = input.setup.v3Text ?? existing?.v3Text ?? plainText;
    const normalizedV3Text = rawV3Text.trim();
    const textTreatment = sceneDialogueAudioTextTreatmentForModel(modelChoice);
    const providerText =
      textTreatment === 'elevenlabs-v3-audio-tags'
        ? normalizedV3Text
        : normalizedPlainText;
    return {
      modelChoice,
      providerText,
      outputFormat:
        input.setup.outputFormat ??
        existing?.outputFormat ??
        DEFAULT_SCENE_DIALOGUE_AUDIO_OUTPUT_FORMAT,
      languageCode: input.setup.languageCode ?? existing?.languageCode ?? null,
    };
  });
}

function requireDialogueForSceneDialogueAudioEstimate(input: {
  session: DatabaseSession;
  sceneId: string;
  dialogueId: string;
}) {
  const scene = readScreenplaySceneFromSession(input.session, input.sceneId);
  const dialogue = scene.blocks.find(
    (block) =>
      block.type === 'dialogue' && block.dialogueId === input.dialogueId
  );
  if (!dialogue || dialogue.type !== 'dialogue') {
    throw new ProjectDataError(
      'PROJECT_DATA380',
      `Dialogue block was not found: ${input.dialogueId}.`
    );
  }
  return dialogue;
}
