import type { GenerationPreviewResource } from '@gorenku/studio-core/server';

type CoreGenerationPreviewResource = Omit<
  GenerationPreviewResource,
  'references'
> & {
  references: {
    slots: Array<Omit<GenerationPreviewResource['references']['slots'][number], 'candidates'> & {
      candidates: Array<Omit<GenerationPreviewResource['references']['slots'][number]['candidates'][number], 'browserUrl'>>;
    }>;
    additional: Array<Omit<GenerationPreviewResource['references']['additional'][number], 'browserUrl'>>;
  };
};

export async function buildGenerationPreviewResource(input: {
  projectName: string;
  preview: CoreGenerationPreviewResource;
}): Promise<GenerationPreviewResource> {
  return {
    ...input.preview,
    references: {
      slots: input.preview.references.slots.map((slot) => ({
        ...slot,
        candidates: slot.candidates.map((reference) => withBrowserUrl(input.projectName, reference)),
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
