import type {
  ImageRevisionDraft,
  ImageRevisionEditorContext,
  ImageRevisionEstimateReport,
  ImageRevisionRunReport,
  ImageRevisionTarget,
  GenerationPreviewResource,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

type StudioImageRevisionModeContext =
  | (Omit<
      Extract<ImageRevisionEditorContext['regenerate'], { state: 'available' }>,
      'preview'
    > & { preview: GenerationPreviewResource })
  | Extract<ImageRevisionEditorContext['regenerate'], { state: 'unavailable' }>;

export type StudioImageRevisionEditorContext = Omit<
  ImageRevisionEditorContext,
  'regenerate' | 'edit'
> & {
  regenerate: StudioImageRevisionModeContext;
  edit: StudioImageRevisionModeContext;
};

export type StudioImageRevisionEstimateReport = Omit<
  ImageRevisionEstimateReport,
  'preview'
> & { preview: GenerationPreviewResource };

export async function readImageRevisionContext(input: {
  projectName: string;
  target: ImageRevisionTarget;
}): Promise<StudioImageRevisionEditorContext> {
  const body = await request(input.projectName, 'context', {
    target: input.target,
  });
  return (body as { context: StudioImageRevisionEditorContext }).context;
}

export async function previewImageRevisionDraft(input: {
  projectName: string;
  target: ImageRevisionTarget;
  draft: ImageRevisionDraft;
}): Promise<GenerationPreviewResource> {
  const body = await request(input.projectName, 'preview', {
    target: input.target,
    draft: input.draft,
  });
  return (body as { preview: GenerationPreviewResource }).preview;
}

export async function estimateImageRevisionDraft(input: {
  projectName: string;
  target: ImageRevisionTarget;
  draft: ImageRevisionDraft;
}): Promise<StudioImageRevisionEstimateReport> {
  const body = await request(input.projectName, 'estimate', {
    target: input.target,
    draft: input.draft,
  });
  return (body as { estimate: StudioImageRevisionEstimateReport }).estimate;
}

export async function runImageRevision(input: {
  projectName: string;
  target: ImageRevisionTarget;
  draft: ImageRevisionDraft;
}): Promise<ImageRevisionRunReport> {
  const body = await request(input.projectName, 'run', {
    target: input.target,
    draft: input.draft,
  });
  return (body as { report: ImageRevisionRunReport }).report;
}

async function request(
  projectName: string,
  command: 'context' | 'preview' | 'estimate' | 'run',
  body: unknown,
): Promise<unknown> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/image-revisions/${command}`,
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return response.json();
}

function jsonHeaders(): Record<string, string> {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return {
    'Content-Type': 'application/json',
    'X-Renku-Studio-Token': token,
  };
}
