import type {
  GenerationPreviewResource,
  GenerationPreviewResourceData,
} from '@gorenku/studio-core/client';

export async function buildGenerationPreviewResource(input: {
  projectName: string;
  preview: GenerationPreviewResourceData;
}): Promise<GenerationPreviewResource> {
  return {
    ...input.preview,
    references: {
      slots: input.preview.references.slots.map((slot) => ({
        ...slot,
        current: slot.current
          ? withBrowserUrl(input.projectName, slot.current)
          : null,
        eligibleCandidates: slot.eligibleCandidates.map((reference) =>
          withBrowserUrl(input.projectName, reference)
        ),
      })),
      additional: input.preview.references.additional.map((reference) =>
        withBrowserUrl(input.projectName, reference)
      ),
    },
  };
}

function withBrowserUrl(
  projectName: string,
  reference: GenerationPreviewResourceData['references']['additional'][number]
): GenerationPreviewResource['references']['additional'][number] {
  if (reference.identity.kind === 'asset-file') {
    return {
      ...reference,
      browserUrl: studioAssetFileUrl({
        projectName,
        assetId: reference.identity.assetId,
        assetFileId: reference.identity.assetFileId,
      }),
    };
  }
  const { projectRelativePath, ...identity } = reference.identity;
  return {
    ...reference,
    identity,
    browserUrl: `/studio-api/projects/${encodeURIComponent(projectName)}/generation-reference-file?path=${encodeURIComponent(projectRelativePath)}`,
  };
}

export function studioAssetFileUrl(input: {
  projectName: string;
  assetId: string;
  assetFileId: string;
}): string {
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/assets/${encodeURIComponent(input.assetId)}/files/${encodeURIComponent(input.assetFileId)}`;
}
