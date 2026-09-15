import { readStudioApiToken, studioApiFetch } from '@/services/studio-api-fetch';
import { createContext, useContext, useEffect, useState } from 'react';
import type { MediaGenerationPreviewResource } from '@gorenku/studio-core/client';
import { readStudioApiError } from '@/services/studio-api-errors';

export interface MediaGenerationRequestInspectorInput {
  projectName: string;
  assetId: string;
}

export const MediaGenerationRequestInspectorContext = createContext<{
  openGenerationRequestInspector: (input: MediaGenerationRequestInspectorInput) => void;
} | null>(null);

export function useGenerationRequestInspectorDialog() {
  const context = useContext(MediaGenerationRequestInspectorContext);
  if (!context) throw new Error('useGenerationRequestInspectorDialog must be used within MediaGenerationRequestInspectorProvider.');
  return context;
}

export function useMediaGenerationRequestInspector(input: MediaGenerationRequestInspectorInput) {
  const { projectName, assetId } = input;
  const requestKey = `${projectName}:${assetId}`;
  const [result, setResult] = useState<{ requestKey: string | null; preview: MediaGenerationPreviewResource | null; error: string | null }>({ requestKey: null, preview: null, error: null });
  useEffect(() => {
    let current = true;
    void readAssetMediaGenerationRequest({ projectName, assetId }).then(
      (preview) => current && setResult({ requestKey, preview, error: null }),
      (reason) => current && setResult({ requestKey, preview: null, error: reason instanceof Error ? reason.message : String(reason) }),
    );
    return () => { current = false; };
  }, [assetId, projectName, requestKey]);
  const current = result.requestKey === requestKey;
  return { preview: current ? result.preview : null, error: current ? result.error : null, loading: !current };
}

async function readAssetMediaGenerationRequest(input: MediaGenerationRequestInspectorInput): Promise<MediaGenerationPreviewResource> {
  const response = await studioApiFetch(`/studio-api/projects/${encodeURIComponent(input.projectName)}/assets/${encodeURIComponent(input.assetId)}/generation-request`, {
    headers: { 'X-Renku-Studio-Token': readStudioApiToken() },
  });
  if (!response.ok) throw await readStudioApiError(response);
  return ((await response.json()) as { preview: MediaGenerationPreviewResource }).preview;
}
