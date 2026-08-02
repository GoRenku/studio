import type { GenerationPreviewResourceReference } from '@gorenku/studio-core/client';

interface GenerationReferencePresentation {
  title?: string;
  accessibleName: string;
}

export function generationReferencePresentation(input: {
  reference: GenerationPreviewResourceReference;
  contextLabel: string;
}): GenerationReferencePresentation {
  const title = input.reference.title?.trim() || undefined;
  return {
    ...(title ? { title } : {}),
    accessibleName: title ?? input.contextLabel,
  };
}
