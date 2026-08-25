import { useState } from 'react';
import { MediaGenerationRequestDialog } from './media-generation-request-dialog';
import type { MediaGenerationRequestTab } from './media-generation-request-view';
import { useMediaGenerationRequestInspector, type MediaGenerationRequestInspectorInput } from './use-media-generation-request-inspector';

export function MediaGenerationRequestInspectorDialog({ input, open, onOpenChange }: {
  input: MediaGenerationRequestInspectorInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<MediaGenerationRequestTab>('prompt');
  const { preview, error, loading } = useMediaGenerationRequestInspector(input);
  return (
    <MediaGenerationRequestDialog
      open={open}
      onOpenChange={onOpenChange}
      preview={preview}
      prompt={preview?.prompt ?? null}
      tab={tab}
      onPromptChange={() => {}}
      onTabChange={setTab}
      loading={loading}
      unavailableMessage={error}
    />
  );
}
