import {
  buildGenerationPreviewSubject,
  resolveGenerationPreviewReferenceFiles,
  validateStudioGenerationPreview,
  type GenerationPreviewRequest,
  type StudioGenerationPreview,
} from '@gorenku/studio-core/server';

export async function buildStudioGenerationPreview(input: {
  projectName: string;
  homeDir?: string;
  preview: GenerationPreviewRequest;
}): Promise<StudioGenerationPreview> {
  const [files, subject] = await Promise.all([
    resolveGenerationPreviewReferenceFiles(input),
    buildGenerationPreviewSubject(input),
  ]);
  return validateStudioGenerationPreview({
    ...input.preview,
    subject,
    references: input.preview.references.map((reference, index) => ({
      ...reference,
      browserUrl: studioAssetFileUrl({
        projectName: input.projectName,
        assetId: files[index]!.assetId,
        assetFileId: files[index]!.assetFileId,
      }),
    })),
  });
}

export function studioAssetFileUrl(input: {
  projectName: string;
  assetId: string;
  assetFileId: string;
}): string {
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/assets/${encodeURIComponent(input.assetId)}/files/${encodeURIComponent(input.assetFileId)}`;
}
