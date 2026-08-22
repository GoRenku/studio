import { GenerationPreviewDialogHost } from '@/features/generation-preview/generation-preview-dialog-host';
import { GenerationRequestInspectorProvider } from '@/features/generation-request-inspector/generation-request-inspector-provider';
import { StudioSetupGate } from '@/app/studio-setup-gate';
import { Toaster } from '@/ui/sonner';

export default function App() {
  return (
    <GenerationRequestInspectorProvider>
      <StudioSetupGate />
      <GenerationPreviewDialogHost />
      <Toaster richColors position='bottom-right' />
    </GenerationRequestInspectorProvider>
  );
}
