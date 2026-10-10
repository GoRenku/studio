import type { ElevenV4VoiceSettings } from '@gorenku/studio-codex/dialogue-direction';
import { Slider } from '@/ui/slider';

export function VoiceSettingsControls(input: {
  voiceSettings: ElevenV4VoiceSettings;
  onVoiceSettingsChange: (voiceSettings: ElevenV4VoiceSettings) => void;
}) {
  return (
    <>
      <VoiceSettingSlider label='Stability' value={input.voiceSettings.stability} onValueChange={(stability) => input.onVoiceSettingsChange({ ...input.voiceSettings, stability })} />
      <VoiceSettingSlider label='Similarity' value={input.voiceSettings.similarity} onValueChange={(similarity) => input.onVoiceSettingsChange({ ...input.voiceSettings, similarity })} />
    </>
  );
}

function VoiceSettingSlider(input: { label: string; value: number; onValueChange: (value: number) => void }) {
  return (
    <span className='flex items-center gap-2.5 text-xs text-[var(--dd-muted-fg)]'>
      {input.label}
      <span className='w-[120px]'>
        <Slider
          appearance='compact'
          min={0}
          max={1}
          step={0.01}
          value={[input.value]}
          aria-label={input.label}
          onValueChange={([value]) => { if (value !== undefined) input.onValueChange(value); }}
        />
      </span>
      <span className='w-[22px] font-[family-name:var(--dd-font-mono)] text-[11px] font-medium tabular-nums text-[var(--dd-fg)]'>{Math.round(input.value * 100)}</span>
    </span>
  );
}
