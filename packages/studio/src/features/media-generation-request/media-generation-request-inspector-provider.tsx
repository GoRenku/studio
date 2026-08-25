import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { MediaGenerationRequestInspectorDialog } from './media-generation-request-inspector-dialog';
import { MediaGenerationRequestInspectorContext, type MediaGenerationRequestInspectorInput } from './use-media-generation-request-inspector';

export function MediaGenerationRequestInspectorProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState<MediaGenerationRequestInspectorInput | null>(null);
  const openGenerationRequestInspector = useCallback((next: MediaGenerationRequestInspectorInput) => setInput(next), []);
  const value = useMemo(() => ({ openGenerationRequestInspector }), [openGenerationRequestInspector]);
  return (
    <MediaGenerationRequestInspectorContext.Provider value={value}>
      {children}
      {input ? <MediaGenerationRequestInspectorDialog key={`${input.projectName}:${input.assetId}`} input={input} open onOpenChange={(open) => { if (!open) setInput(null); }} /> : null}
    </MediaGenerationRequestInspectorContext.Provider>
  );
}
