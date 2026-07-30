import type {
  GenerationEditorControl,
  GenerationPreviewConfigurationValue,
} from '@gorenku/studio-core/client';
import { GenerationRequestControlsPanel } from './generation-request-controls-panel';

export function GenerationRequestVideoSetup({
  controls,
  disabled,
  onControlChange,
}: {
  controls: GenerationEditorControl[];
  disabled: boolean;
  onControlChange: (
    controlId: string,
    value: GenerationPreviewConfigurationValue,
  ) => void;
}) {
  return (
    <section className='min-w-0 p-5'>
      <h3 className='mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        Setup
      </h3>
      <GenerationRequestControlsPanel
        controls={controls}
        disabled={disabled}
        onChange={onControlChange}
        compact
      />
    </section>
  );
}
