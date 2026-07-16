import type { GenerationPreview, GenerationPurpose, GenerationReference, GenerationSpec, GenerationTarget } from '../../client/generation.js';
import { createRandomIdGenerator } from '../entity-ids.js';
import { estimateGeneration } from '../generation/estimates.js';
import { buildGenerationPreview } from '../generation/previews.js';
import { withGenerationProject } from '../generation/project-operation.js';
import { listGenerationModels, readGenerationPurpose } from '../generation/purposes.js';
import { listGenerationReferences } from '../generation/references.js';
import { readGenerationRun, runGeneration } from '../generation/runs.js';
import { applyFixedGenerationSettings } from '../generation/purpose-settings.js';
import { createGenerationSpec, listGenerationSpecs, readGenerationSpec, updateGenerationSpec } from '../generation/specs.js';
import { validateGenerationSpec, validateGenerationSpecForExecution } from '../generation/validation.js';
import { attachGenerationMedia } from '../generation/attachments.js';
import { preparePurposeExecutionSpec } from '../generation/purpose-execution.js';
import { effectiveProjectAspectRatio } from '../database/access/project-information.js';
import { readProjectRecord } from '../database/access/project.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import type { SceneStoryboardImagesImportDocument } from '../../client/scene-shot-list.js';
import { attachSceneStoryboardImages } from '../generation/scene-storyboard-attachments.js';
import { projectGenerationPreviewResource } from '../generation-preview-resource/projection.js';
import { updateGenerationPreviewResource } from '../generation-preview-resource/update.js';
import { readSceneDialogueAudioWorkspace } from '../scene-dialogue-audio-workspace/context.js';
import { estimateSceneDialogueAudioDraft, generateSceneDialogueAudioTake } from '../scene-dialogue-audio-workspace/generation.js';
import { updateSceneDialogueAudioSetup } from '../scene-dialogue-audio-workspace/setup.js';
import { discardSceneDialogueAudioTake } from '../scene-dialogue-audio-workspace/takes.js';
import { listShotVideoTakeOverviews } from '../shot-video-take-workspace/queries.js';
import { readShotVideoTakeWorkspace } from '../shot-video-take-workspace/workspace.js';
import {
  createShotVideoTake,
  createSceneShotVideoTakeFromTake,
  discardShotVideoTake,
  replaceShotVideoTakeShots,
  setShotVideoTakePicked,
} from '../shot-video-take-workspace/lifecycle-commands.js';
import {
  setShotVideoTakeDirection,
  setShotVideoTakeStructure,
} from '../shot-video-take-workspace/design-commands.js';
import {
  estimateShotVideoTakeGeneration,
  setShotVideoTakeGenerationGenericReferences,
  setShotVideoTakeGenerationReference,
  setShotVideoTakeGenerationSpec,
} from '../shot-video-take-workspace/generation-commands.js';
import { attachShotVideoTakeOutput } from '../shot-video-take-workspace/outputs.js';
import { resolveGenerationRunOutputRoot } from '../project-asset-files/index.js';
import type { GenerationReferenceSlotSelectionInput } from '../../client/generation.js';
import {
  discardSceneShotGenericReferenceAsset,
  registerSceneShotGenericReferenceAsset,
} from '../commands/scene-shot-reference-asset-commands.js';

type ProjectInput = RenkuConfigPathOptions & { projectName?: string };

export function createGenerationServiceWiring() {
  return {
    async buildGenerationContext(input: ProjectInput & { purpose: GenerationPurpose; target: GenerationTarget; facts?: Record<string, never> }) {
      return withGenerationProject(input, ({ session, projectFolder }) =>
        readGenerationPurpose(input.purpose).buildContext({ target: input.target, facts: input.facts, session, projectFolder })
      );
    },
    async listGenerationModels(input: ProjectInput & { purpose?: GenerationPurpose; outputMediaKind?: 'image' | 'audio' | 'video' }) {
      if (input.purpose) {
        const purpose = readGenerationPurpose(input.purpose);
        return listGenerationModels({ outputMediaKind: purpose.outputMediaKind, use: purpose.modelUse, fixedSettings: purpose.settings.fixed });
      }
      return listGenerationModels({ outputMediaKind: input.outputMediaKind });
    },
    async listGenerationReferences(input: ProjectInput & { mediaKind?: 'image' | 'audio' | 'video'; owner?: { kind: string; id: string }; assetId?: string; assetRole?: string; search?: string; cursor?: string | null; limit?: number }) {
      return withGenerationProject(input, ({ session }) => listGenerationReferences({ ...input, session }));
    },
    async registerSceneShotGenericReferenceAsset(input: ProjectInput & { sceneId: string; shotListId: string; shotId: string; assetId: string; assetFileId: string }) {
      return withGenerationProject(input, ({ session }) => registerSceneShotGenericReferenceAsset({ ...input, session, idGenerator: createRandomIdGenerator(), now: new Date().toISOString() }));
    },
    async discardSceneShotGenericReferenceAsset(input: ProjectInput & { relationshipId: string }) {
      return withGenerationProject(input, ({ session, projectFolder }) => discardSceneShotGenericReferenceAsset({ ...input, session, projectFolder }));
    },
    async validateGenerationSpec(input: ProjectInput & { spec: GenerationSpec }) {
      return withGenerationProject(input, async ({ session, projectFolder }) => {
        const purpose = readGenerationPurpose(input.spec.purpose);
        const spec = await preparePurposeExecutionSpec({ spec: input.spec, purpose, projectAspectRatio: projectAspectRatio(session) });
        return validateGenerationSpec({ spec, purpose, session, projectFolder });
      });
    },
    async createGenerationSpec(input: ProjectInput & { spec: GenerationSpec }) {
      return withGenerationProject(input, async ({ session, projectFolder }) => {
        const purpose = readGenerationPurpose(input.spec.purpose);
        const authored = await applyFixedGenerationSettings({ spec: input.spec, purpose });
        return createGenerationSpec({ id: createRandomIdGenerator().next('media_generation_spec'), spec: authored, purpose, session, now: new Date().toISOString() });
      });
    },
    async updateGenerationSpec(input: ProjectInput & { specId: string; spec: GenerationSpec }) {
      return withGenerationProject(input, async ({ session, projectFolder }) => {
        const purpose = readGenerationPurpose(input.spec.purpose);
        const authored = await applyFixedGenerationSettings({ spec: input.spec, purpose });
        return updateGenerationSpec({ id: input.specId, spec: authored, purpose, session, now: new Date().toISOString() });
      });
    },
    async readGenerationSpec(input: ProjectInput & { specId: string }) {
      return withGenerationProject(input, ({ session }) => readGenerationSpec({ id: input.specId, session }));
    },
    async listGenerationSpecs(input: ProjectInput & { purpose?: string; target?: GenerationTarget }) {
      return withGenerationProject(input, ({ session }) => listGenerationSpecs({ session, purpose: input.purpose, target: input.target }));
    },
    async buildGenerationPreview(input: ProjectInput & ({ specId: string } | { spec: GenerationSpec })) {
      return withGenerationProject(input, async ({ session, projectFolder }) => {
        const rawSpec = 'specId' in input ? readGenerationSpec({ id: input.specId, session }).spec : input.spec;
        const purpose = readGenerationPurpose(rawSpec.purpose);
        const authoredSpec = await applyFixedGenerationSettings({ spec: rawSpec, purpose });
        const spec = await preparePurposeExecutionSpec({ spec: rawSpec, purpose, projectAspectRatio: projectAspectRatio(session) });
        const context = await purpose.buildContext({ target: authoredSpec.target, session, projectFolder });
        const validation = await validateGenerationSpecForExecution({ spec, purpose, session, projectFolder });
        const preview = await buildGenerationPreview({ spec: authoredSpec, referenceGuide: context.referenceGuide, session, projectFolder, validatedRequest: validation.valid ? validation.request : undefined });
        const enriched = { ...preview, settings: context.settings, models: context.models };
        return 'specId' in input ? { ...enriched, specId: input.specId } : enriched;
      });
    },
    async buildGenerationPreviewResource(input: ProjectInput & { preview: GenerationPreview }) {
      return withGenerationProject(input, ({ session }) =>
        projectGenerationPreviewResource({ preview: input.preview, session })
      );
    },
    async updateGenerationPreviewResource(input: ProjectInput & {
      specId: string;
      prompt: { authoredText: string; negativeText?: string | null };
      slotSelections: GenerationReferenceSlotSelectionInput[];
      genericReferences: GenerationReference[];
    }) {
      return withGenerationProject(input, ({ session, projectFolder }) => {
        const record = readGenerationSpec({ id: input.specId, session });
        return updateGenerationPreviewResource({
          ...input,
          purpose: readGenerationPurpose(record.spec.purpose),
          session,
          projectFolder,
          now: new Date().toISOString(),
        });
      });
    },
    async readSceneDialogueAudioWorkspace(input: ProjectInput & { sceneId: string }) {
      return withGenerationProject(input, ({ session }) =>
        readSceneDialogueAudioWorkspace({ session, sceneId: input.sceneId })
      );
    },
    async updateSceneDialogueAudioSetup(input: ProjectInput & {
      sceneId: string;
      dialogueId: string;
      setup: Partial<import('../../client/scene-dialogue-audio-workspace.js').SceneDialogueAudioSetup>;
    }) {
      return withGenerationProject(input, ({ session }) =>
        updateSceneDialogueAudioSetup({
          ...input,
          session,
          idGenerator: createRandomIdGenerator(),
          now: new Date().toISOString(),
        })
      );
    },
    async estimateSceneDialogueAudioDraft(input: ProjectInput & {
      spec: import('../../client/scene-dialogue-audio-workspace.js').SceneDialogueAudioSetup;
    }) {
      return withGenerationProject(input, ({ session, projectFolder }) =>
        estimateSceneDialogueAudioDraft({
          session,
          projectFolder,
          setup: input.spec,
        })
      );
    },
    async generateSceneDialogueAudioTake(input: ProjectInput & {
      sceneId: string;
      dialogueId: string;
      setup: Partial<import('../../client/scene-dialogue-audio-workspace.js').SceneDialogueAudioSetup>;
      simulate?: boolean;
      approveLiveProviderRun?: boolean;
    }) {
      return withGenerationProject(input, ({ session, projectFolder }) =>
        generateSceneDialogueAudioTake({
          ...input,
          session,
          projectFolder,
          idGenerator: createRandomIdGenerator(),
          now: new Date().toISOString(),
        })
      );
    },
    async deleteSceneDialogueAudioTake(input: ProjectInput & {
      sceneId: string;
      dialogueId: string;
      takeId: string;
    }) {
      return withGenerationProject(input, ({ session, projectFolder }) =>
        discardSceneDialogueAudioTake({ ...input, session, projectFolder })
      );
    },
    async estimateGeneration(input: ProjectInput & { specId: string }) {
      return withGenerationProject(input, async ({ session, projectFolder }) => {
        const record = readGenerationSpec({ id: input.specId, session });
        const purpose = readGenerationPurpose(record.spec.purpose);
        return estimateGeneration({ spec: await preparePurposeExecutionSpec({ spec: record.spec, purpose, projectAspectRatio: projectAspectRatio(session) }), purpose });
      });
    },
    async runGeneration(input: ProjectInput & { specId: string; approvalToken: string; mode: 'simulated' | 'live' }) {
      return withGenerationProject(input, async ({ session, projectFolder }) => {
        const record = readGenerationSpec({ id: input.specId, session });
        const purpose = readGenerationPurpose(record.spec.purpose);
        const id = createRandomIdGenerator().next('media_generation_run');
        const outputRoot = await resolveGenerationRunOutputRoot({
          projectFolder,
          runId: id,
          purpose: purpose.purpose,
        });
        return runGeneration({ id, specId: record.id, spec: await preparePurposeExecutionSpec({ spec: record.spec, purpose, projectAspectRatio: projectAspectRatio(session) }), purpose, approvalToken: input.approvalToken, mode: input.mode, session, projectFolder, outputRoot: outputRoot.absoluteRoot, outputProjectRelativeRoot: outputRoot.projectRelativeRoot, now: new Date().toISOString() });
      });
    },
    async readGenerationRun(input: ProjectInput & { runId: string }) {
      return withGenerationProject(input, ({ session }) => readGenerationRun({ id: input.runId, session }));
    },
    async attachGenerationMedia(input: ProjectInput & { purpose: GenerationPurpose; target: GenerationTarget; sourceProjectRelativePath: string; title?: string; receipt?: unknown }) {
      return withGenerationProject(input, ({ session, projectFolder }) => attachGenerationMedia({ ...input, session, projectFolder, idGenerator: createRandomIdGenerator() }));
    },
    async attachSceneStoryboardImages(input: ProjectInput & { sceneId: string; shotListId: string; document: SceneStoryboardImagesImportDocument }) {
      return withGenerationProject(input, ({ session, projectFolder }) => attachSceneStoryboardImages({ ...input, session, projectFolder, idGenerator: createRandomIdGenerator() }));
    },
    async listShotVideoTakes(input: ProjectInput & { sceneId: string }) {
      return withGenerationProject(input, ({ session }) =>
        listShotVideoTakeOverviews({ session, sceneId: input.sceneId })
      );
    },
    async readShotVideoTakeWorkspace(input: ProjectInput & { sceneId: string; takeId: string; selectedShotId?: string }) {
      return withGenerationProject(input, ({ session, projectFolder }) =>
        readShotVideoTakeWorkspace({ ...input, session, projectFolder })
      );
    },
    async createShotVideoTake(input: ProjectInput & { sceneId: string; shotListId: string; shotIds: string[]; title?: string }) {
      return withGenerationProject(input, ({ session }) => createShotVideoTake({ ...input, session, idGenerator: createRandomIdGenerator(), now: new Date().toISOString() }));
    },
    async createSceneShotVideoTakeFromTake(input: ProjectInput & { sceneId: string; sourceTakeId: string }) {
      return withGenerationProject(input, ({ session, projectFolder }) => createSceneShotVideoTakeFromTake({ ...input, session, projectFolder, idGenerator: createRandomIdGenerator(), now: new Date().toISOString() }));
    },
    async discardShotVideoTake(input: ProjectInput & { sceneId: string; takeId: string }) {
      return withGenerationProject(input, ({ session, projectFolder }) => discardShotVideoTake({ ...input, session, projectFolder }));
    },
    async setShotVideoTakePicked(input: ProjectInput & { sceneId: string; takeId: string; picked: boolean }) {
      return withGenerationProject(input, ({ session }) => setShotVideoTakePicked({ ...input, session, now: new Date().toISOString() }));
    },
    async replaceShotVideoTakeShots(input: ProjectInput & { sceneId: string; takeId: string; shotIds: string[] }) {
      return withGenerationProject(input, ({ session, projectFolder }) => replaceShotVideoTakeShots({ ...input, session, projectFolder, now: new Date().toISOString() }));
    },
    async setShotVideoTakeStructure(input: ProjectInput & { sceneId: string; takeId: string; mode: import('../../client/shot-video-take-workspace.js').SceneShotVideoTakeStructureMode; sourceShotId?: string }) {
      return withGenerationProject(input, ({ session, projectFolder }) => setShotVideoTakeStructure({ ...input, session, projectFolder, now: new Date().toISOString() }));
    },
    async setShotVideoTakeDirection(input: ProjectInput & { sceneId: string; takeId: string; shotId?: string; direction: import('../../client/shot-video-take-workspace.js').SceneShotVideoTakeDirection | null }) {
      return withGenerationProject(input, ({ session, projectFolder }) => setShotVideoTakeDirection({ ...input, session, projectFolder, now: new Date().toISOString() }));
    },
    async setShotVideoTakeGenerationSpec(input: ProjectInput & { sceneId: string; takeId: string; selectedShotId?: string; setup: import('../../client/shot-video-take-workspace.js').ShotVideoTakeGenerationSetup }) {
      return withGenerationProject(input, ({ session, projectFolder }) => setShotVideoTakeGenerationSpec({ ...input, session, projectFolder, idGenerator: createRandomIdGenerator(), now: new Date().toISOString() }));
    },
    async setShotVideoTakeGenerationReference(input: ProjectInput & { sceneId: string; takeId: string; selectedShotId?: string; selection: GenerationReferenceSlotSelectionInput }) {
      return withGenerationProject(input, ({ session, projectFolder }) => setShotVideoTakeGenerationReference({ ...input, session, projectFolder, idGenerator: createRandomIdGenerator(), now: new Date().toISOString() }));
    },
    async setShotVideoTakeGenerationGenericReferences(input: ProjectInput & { sceneId: string; takeId: string; selectedShotId?: string; references: GenerationReference[] }) {
      return withGenerationProject(input, ({ session, projectFolder }) => setShotVideoTakeGenerationGenericReferences({ ...input, session, projectFolder, idGenerator: createRandomIdGenerator(), now: new Date().toISOString() }));
    },
    async estimateShotVideoTakeGeneration(input: ProjectInput & { sceneId: string; takeId: string; setup?: import('../../client/shot-video-take-workspace.js').ShotVideoTakeGenerationSetup }) {
      return estimateShotVideoTakeGeneration({ setup: input.setup });
    },
    async attachShotVideoTakeOutput(input: ProjectInput & { sceneId: string; takeId: string; sourceProjectRelativePath: string; title?: string; receipt: unknown }) {
      return withGenerationProject(input, ({ session, projectFolder }) => attachShotVideoTakeOutput({ ...input, session, projectFolder, idGenerator: createRandomIdGenerator() }));
    },
  };
}

function projectAspectRatio(session: Parameters<typeof readProjectRecord>[0]): string {
  return effectiveProjectAspectRatio(readProjectRecord(session)?.aspectRatio);
}
