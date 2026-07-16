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

function withBrowserUrl<T extends { assetId: string; assetFileId: string }>(
  projectName: string,
  reference: T
): T & { browserUrl: string } {
  return {
    ...reference,
    browserUrl: studioAssetFileUrl({
      projectName,
      assetId: reference.assetId,
      assetFileId: reference.assetFileId,
    }),
  };
}

export function studioAssetFileUrl(input: {
  projectName: string;
  assetId: string;
  assetFileId: string;
}): string {
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/assets/${encodeURIComponent(input.assetId)}/files/${encodeURIComponent(input.assetFileId)}`;
}
