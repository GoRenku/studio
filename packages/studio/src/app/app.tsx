import { MediaGenerationPreviewDialogHost } from '@/features/media-generation-request/media-generation-preview-dialog-host';
import { MediaGenerationRequestInspectorProvider } from '@/features/media-generation-request/media-generation-request-inspector-provider';
import { StudioSetupGate } from '@/app/studio-setup-gate';
import { Toaster } from '@/ui/sonner';

export default function App() {
  return (
    <MediaGenerationRequestInspectorProvider>
      <StudioSetupGate />
      <MediaGenerationPreviewDialogHost />
      <Toaster richColors position='bottom-right' />
    </MediaGenerationRequestInspectorProvider>
  );
}
