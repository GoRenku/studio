import type { GenerationPreviewResource } from '@gorenku/studio-core/server';

type CoreGenerationPreviewResource = Omit<
  GenerationPreviewResource,
  'references'
> & {
  references: Array<
    Omit<GenerationPreviewResource['references'][number], 'browserUrl'>
  >;
};

export async function buildGenerationPreviewResource(input: {
  projectName: string;
  preview: CoreGenerationPreviewResource;
}): Promise<GenerationPreviewResource> {
  return {
    ...input.preview,
    references: input.preview.references.map((reference) => ({
      ...reference,
      browserUrl: studioAssetFileUrl({
        projectName: input.projectName,
        assetId: reference.assetId,
        assetFileId: reference.assetFileId,
      }),
    })),
  };
}

export function studioAssetFileUrl(input: {
  projectName: string;
  assetId: string;
  assetFileId: string;
}): string {
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/assets/${encodeURIComponent(input.assetId)}/files/${encodeURIComponent(input.assetFileId)}`;
}
