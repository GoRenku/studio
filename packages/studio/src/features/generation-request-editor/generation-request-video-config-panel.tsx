import type {
  GenerationEditorControl,
  GenerationPreviewConfigurationValue,
  GenerationPreviewVideoInputMode,
  GenerationPreviewVideoModelFamily,
  ShotPlanVideoInputMode,
} from '@gorenku/studio-core/client';
import { GenerationRequestVideoInputList } from './generation-request-video-input-list';
import { GenerationRequestVideoModelList } from './generation-request-video-model-list';
import { GenerationRequestVideoSetup } from './generation-request-video-setup';

export function GenerationRequestVideoConfigPanel({
  inputModes,
  inputMode,
  modelFamilies,
  modelFamilyId,
  controls,
  disabled,
  onInputModeChange,
  onModelChange,
  onControlChange,
}: {
  inputModes: GenerationPreviewVideoInputMode[];
  inputMode: ShotPlanVideoInputMode;
  modelFamilies: GenerationPreviewVideoModelFamily[];
  modelFamilyId: string;
  controls: GenerationEditorControl[];
  disabled: boolean;
  onInputModeChange: (value: ShotPlanVideoInputMode) => void;
  onModelChange: (value: string) => void;
  onControlChange: (
    controlId: string,
    value: GenerationPreviewConfigurationValue,
  ) => void;
}) {
  return (
    <div className='grid min-h-full grid-cols-[minmax(360px,1.2fr)_224px_minmax(320px,0.8fr)]'>
      <GenerationRequestVideoModelList
        families={modelFamilies}
        value={modelFamilyId}
        disabled={disabled}
        onChange={onModelChange}
      />
      <GenerationRequestVideoInputList
        modes={inputModes}
        value={inputMode}
        disabled={disabled}
        onChange={onInputModeChange}
      />
      <GenerationRequestVideoSetup
        controls={controls}
        disabled={disabled}
        onControlChange={onControlChange}
      />
    </div>
  );
}
