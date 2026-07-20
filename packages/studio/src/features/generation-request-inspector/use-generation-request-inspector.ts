import { createContext, useContext, useEffect, useState } from 'react';
import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import { readAssetFileGenerationRequest } from '@/services/studio-generation-requests-api';

export interface GenerationRequestInspectorInput {
  projectName: string;
  assetId: string;
  assetFileId: string;
}

export interface GenerationRequestInspectorDialogContextValue {
  openGenerationRequestInspector: (
    input: GenerationRequestInspectorInput,
  ) => void;
}

export const GenerationRequestInspectorDialogContext =
  createContext<GenerationRequestInspectorDialogContextValue | null>(null);

export function useGenerationRequestInspectorDialog() {
  const context = useContext(GenerationRequestInspectorDialogContext);
  if (!context) {
    throw new Error(
      'useGenerationRequestInspectorDialog must be used within GenerationRequestInspectorProvider.',
    );
  }
  return context;
}

export function useGenerationRequestInspector(
  input: GenerationRequestInspectorInput,
) {
  const { projectName, assetId, assetFileId } = input;
  const requestKey = `${projectName}:${assetId}:${assetFileId}`;
  const [result, setResult] = useState<{
    requestKey: string | null;
    preview: GenerationPreviewResource | null;
    error: string | null;
  }>({ requestKey: null, preview: null, error: null });

  useEffect(() => {
    let current = true;
    void readAssetFileGenerationRequest({
      projectName,
      assetId,
      assetFileId,
    }).then(
      (nextPreview) => {
        if (!current) {
          return;
        }
        setResult({ requestKey, preview: nextPreview, error: null });
      },
      (reason) => {
        if (!current) {
          return;
        }
        setResult({
          requestKey,
          preview: null,
          error: reason instanceof Error ? reason.message : String(reason),
        });
      },
    );
    return () => {
      current = false;
    };
  }, [projectName, assetId, assetFileId, requestKey]);

  const currentResult = result.requestKey === requestKey;
  return {
    preview: currentResult ? result.preview : null,
    error: currentResult ? result.error : null,
    loading: !currentResult,
  };
}
