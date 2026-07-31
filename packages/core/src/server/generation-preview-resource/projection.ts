import { randomUUID } from 'node:crypto';
import type {
  GenerationEstimate,
  GenerationPreview,
} from '../../client/generation.js';
import type {
  GenerationPreviewResource,
} from '../../client/generation-preview-resource.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  projectGenerationPreviewAuthoring,
  projectGenerationPreviewConfiguration,
} from './configuration.js';
import { projectGenerationPreviewPrompt } from './prompt.js';
import { projectGenerationPreviewReferences } from './references.js';
import { readGenerationPreviewSubject } from './subjects.js';

export async function projectGenerationPreviewResource(input: {
  preview: GenerationPreview;
  session: DatabaseSession;
  estimate?: GenerationEstimate;
}): Promise<import('../../client/generation-preview-resource.js').GenerationPreviewResourceData> {
  const project = readProjectRecord(input.session);
  const model = input.preview.models?.find(
    (candidate) =>
      candidate.provider === input.preview.spec.model?.provider &&
      candidate.model === input.preview.spec.model?.model
  );
  const provider = input.preview.spec.model?.provider ?? '';
  const modelId = input.preview.spec.model?.model ?? '';
  const authoring = await projectGenerationPreviewAuthoring({
    preview: input.preview,
    model,
  });
  return {
    kind: 'generationPreview',
    previewId: `generation-preview-${randomUUID()}`,
    ...(input.preview.generationSpec
      ? { generationSpec: input.preview.generationSpec }
      : {}),
    purpose: input.preview.spec.purpose as GenerationPreviewResource['purpose'],
    project: {
      id: project?.id ?? '',
      name: project?.name ?? '',
      ...(project?.title ? { title: project.title } : {}),
    },
    target: input.preview.spec.target,
    title: input.preview.spec.title ?? 'Generation Preview',
    subject: readGenerationPreviewSubject(input.session, input.preview.spec.target),
    model: {
      provider,
      modelId,
      executionPath: input.preview.spec.executionKind,
      mediaKind: model?.mediaKind ?? 'image',
    },
    finalPrompt: projectGenerationPreviewPrompt({
      preview: input.preview,
      model,
    }),
    references: projectGenerationPreviewReferences(input.preview),
    configuration: await projectGenerationPreviewConfiguration({
      preview: input.preview,
      authoring,
    }),
    authoring,
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
