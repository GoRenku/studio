import { MediaGenerationPreviewDialogHost } from '@/features/media-generation-request/media-generation-preview-dialog-host';
import { MediaGenerationRequestInspectorProvider } from '@/features/media-generation-request/media-generation-request-inspector-provider';
import { StudioSetupGate } from '@/app/studio-setup-gate';
import { Toaster } from '@/ui/sonner';
import { useStudioUpdate } from './use-studio-update';

export default function App() {
  const update = useStudioUpdate();
  return (
    <MediaGenerationRequestInspectorProvider>
      <StudioSetupGate update={update} />
      <MediaGenerationPreviewDialogHost />
      <Toaster richColors position='bottom-right' />
    </MediaGenerationRequestInspectorProvider>
  );
}
