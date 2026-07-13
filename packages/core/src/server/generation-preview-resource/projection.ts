import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type {
  GenerationEstimate,
  GenerationPreview,
} from '../../client/generation.js';
import type {
  GenerationPreviewResource,
  GenerationPreviewSubject,
} from '../../client/generation-preview-resource.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { sceneShotVideoTakes, scenes } from '../schema/index.js';
import { projectGenerationPreviewConfiguration } from './configuration.js';
import { projectGenerationPreviewPrompt } from './prompt.js';
import { projectGenerationPreviewReferences } from './references.js';

export function projectGenerationPreviewResource(input: {
  preview: GenerationPreview;
  session: DatabaseSession;
  estimate?: GenerationEstimate;
}): Omit<GenerationPreviewResource, 'references'> & {
  references: Array<
    Omit<GenerationPreviewResource['references'][number], 'browserUrl'>
  >;
} {
  const project = readProjectRecord(input.session);
  const model = input.preview.models?.find(
    (candidate) =>
      candidate.provider === input.preview.spec.model?.provider &&
      candidate.model === input.preview.spec.model?.model
  );
  const provider = input.preview.spec.model?.provider ?? '';
  const modelId = input.preview.spec.model?.model ?? '';
  return {
    kind: 'generationPreview',
    previewId: `generation-preview-${randomUUID()}`,
    ...(input.preview.specId
      ? { generationSpecId: input.preview.specId }
      : {}),
    purpose: input.preview.spec.purpose as GenerationPreviewResource['purpose'],
    project: {
      id: project?.id ?? '',
      name: project?.name ?? '',
      ...(project?.title ? { title: project.title } : {}),
    },
    target: input.preview.spec.target,
    title: input.preview.spec.title ?? 'Generation Preview',
    subject: projectSubject(input.session, input.preview),
    model: {
      provider,
      modelId,
      mediaKind: model?.mediaKind ?? 'image',
    },
    finalPrompt: projectGenerationPreviewPrompt({
      preview: input.preview,
      model,
    }),
    references: projectGenerationPreviewReferences(input.preview),
    configuration: projectGenerationPreviewConfiguration({
      preview: input.preview,
      model,
    }),
    ...(input.preview.providerPayload
      ? {
          providerPreview: {
            provider,
            model: modelId,
            payload: input.preview.providerPayload,
          },
        }
      : {}),
    ...(input.estimate
      ? {
          estimate: {
            state: 'estimated' as const,
            estimatedCostUsd: input.estimate.estimatedCostUsd,
          },
        }
      : {}),
    diagnostics: input.preview.diagnostics,
  };
}

function projectSubject(
  session: DatabaseSession,
  preview: GenerationPreview
): GenerationPreviewSubject {
  const project = readProjectRecord(session);
  const result: GenerationPreviewSubject = {
    projectLabel: project?.title || project?.name || 'Project',
  };
  if (preview.spec.target.kind === 'castMember') {
    const castMember = readCastMemberRecord(session, preview.spec.target.id);
    return {
      ...result,
      ...(castMember?.name ? { castMemberLabel: castMember.name } : {}),
    };
  }
  if (preview.spec.target.kind !== 'sceneShotVideoTake') {
    return result;
  }
  const take = session.db
    .select()
    .from(sceneShotVideoTakes)
    .where(eq(sceneShotVideoTakes.id, preview.spec.target.id))
    .get();
  const scene = take
    ? session.db
        .select()
        .from(scenes)
        .where(eq(scenes.id, take.sceneId))
        .get()
    : null;
  return {
    ...result,
    ...(scene?.title ? { sceneLabel: scene.title } : {}),
    ...(take?.title ? { takeLabel: take.title } : {}),
  };
}
