import { RotateCcw } from 'lucide-react';
import type {
  SceneDialogueAudioModelChoiceReport,
  SceneDialogueAudioVoiceSettings,
} from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { Slider } from '@/ui/slider';
import { Switch } from '@/ui/switch';
import type { SceneDialogueAudioDraft } from './use-scene-dialogue-audio';

interface SceneDialogueAudioAdvancedTabProps {
  baseLanguageCode: string | null;
  disabled: boolean;
  draft: SceneDialogueAudioDraft;
  selectedModel: SceneDialogueAudioModelChoiceReport | undefined;
  onDraftChange: (patch: Partial<SceneDialogueAudioDraft>) => void;
  onReset: () => void;
  onVoiceSettingsChange: (patch: Partial<SceneDialogueAudioVoiceSettings>) => void;
}

export function SceneDialogueAudioAdvancedTab({
  baseLanguageCode,
  disabled,
  draft,
  selectedModel,
  onDraftChange,
  onReset,
  onVoiceSettingsChange,
}: SceneDialogueAudioAdvancedTabProps) {
  const outputFormats = selectedModel?.outputFormats.length
    ? selectedModel.outputFormats
    : [draft.outputFormat];
  const languageEnabled = draft.languageCode !== null;
  const languageOptions = languageOverrideOptions(
    baseLanguageCode,
    draft.languageCode
  );
  const defaultLanguageOverrideCode = languageOptions[0]?.value ?? 'en';
  const languageSelectValue = draft.languageCode ?? 'auto';

  return (
    <div className='flex flex-col gap-5'>
      {supportsSetting(selectedModel, draft.voiceSettings, 'speed') ? (
        <VoiceSlider
          label='Speed'
          leftLabel='Slower'
          rightLabel='Faster'
          value={draft.voiceSettings.speed ?? 1}
          min={0.7}
          max={1.2}
          step={0.01}
          disabled={disabled}
          formatValue={(value) => value.toFixed(2)}
          onValueChange={(speed) => onVoiceSettingsChange({ speed })}
        />
      ) : null}

      {supportsSetting(selectedModel, draft.voiceSettings, 'stability') ? (
        <VoiceSlider
          label='Stability'
          leftLabel='More variable'
          rightLabel='More stable'
          value={draft.voiceSettings.stability ?? 0.5}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          formatValue={(value) => value.toFixed(2)}
          onValueChange={(stability) => onVoiceSettingsChange({ stability })}
        />
      ) : null}

      {supportsSetting(selectedModel, draft.voiceSettings, 'similarityBoost') ? (
        <VoiceSlider
          label='Similarity'
          leftLabel='Low'
          rightLabel='High'
          value={draft.voiceSettings.similarityBoost ?? 0.75}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          formatValue={(value) => value.toFixed(2)}
          onValueChange={(similarityBoost) =>
            onVoiceSettingsChange({ similarityBoost })
          }
        />
      ) : null}

      {supportsSetting(selectedModel, draft.voiceSettings, 'style') ? (
        <VoiceSlider
          label='Style'
          leftLabel='Subtle'
          rightLabel='Exaggerated'
          value={draft.voiceSettings.style ?? 0}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          formatValue={(value) => value.toFixed(2)}
          onValueChange={(style) => onVoiceSettingsChange({ style })}
        />
      ) : null}

      {supportsSetting(selectedModel, draft.voiceSettings, 'useSpeakerBoost') ? (
        <div className='flex items-center justify-between gap-4 rounded-md border border-border/40 bg-muted/20 px-3 py-2'>
          <div className='flex flex-col gap-0.5'>
            <span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground'>
              Speaker Boost
            </span>
            <span className='text-xs text-muted-foreground'>
              Preserve the selected voice identity.
            </span>
          </div>
          <Switch
            checked={Boolean(draft.voiceSettings.useSpeakerBoost)}
            disabled={disabled}
            onCheckedChange={(useSpeakerBoost) =>
              onVoiceSettingsChange({ useSpeakerBoost })
            }
            aria-label='Speaker Boost'
          />
        </div>
      ) : null}

      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-3'>
          <span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground'>
            Language Override
          </span>
          <Switch
            checked={languageEnabled}
            disabled={disabled}
            onCheckedChange={(enabled) =>
              onDraftChange({
                languageCode: enabled ? defaultLanguageOverrideCode : null,
              })
            }
            aria-label='Language Override'
          />
        </div>
        <Select
          value={languageSelectValue}
          disabled={disabled || !languageEnabled}
          onValueChange={(value) =>
            onDraftChange({ languageCode: value === 'auto' ? null : value })
          }
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value='auto'>Auto (Recommended)</SelectItem>
              {languageOptions.map((language) => (
                <SelectItem key={language.value} value={language.value}>
                  {language.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className='flex flex-col gap-2'>
        <span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground'>
          Output Format
        </span>
        <Select
          value={draft.outputFormat}
          disabled={disabled}
          onValueChange={(outputFormat) => onDraftChange({ outputFormat })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {outputFormats.map((format) => (
                <SelectItem key={format} value={format}>
                  {formatOutputFormat(format)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className='flex justify-end pt-1'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          disabled={disabled}
          onClick={onReset}
          className='gap-2'
        >
          <RotateCcw className='h-3.5 w-3.5' aria-hidden />
          Reset values
        </Button>
      </div>
    </div>
  );
}

const supportedLanguageOverrideOptions = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'tr', label: 'Turkish' },
] as const;

function languageOverrideOptions(
  baseLanguageCode: string | null,
  selectedLanguageCode: string | null
): { value: string; label: string }[] {
  const options = new Map<string, string>();

  for (const languageCode of [baseLanguageCode, selectedLanguageCode]) {
    const normalizedCode = normalizeLanguageCode(languageCode);
    if (normalizedCode) {
      options.set(normalizedCode, formatLanguageCode(normalizedCode));
    }
  }

  for (const option of supportedLanguageOverrideOptions) {
    options.set(option.value, option.label);
  }

  return [...options].map(([value, label]) => ({ value, label }));
}

function VoiceSlider({
  label,
  leftLabel,
  rightLabel,
  value,
  min,
  max,
  step,
  disabled,
  formatValue,
  onValueChange,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  formatValue: (value: number) => string;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground'>
          {label}
        </span>
        <span className='rounded-md bg-foreground px-2 py-0.5 text-xs font-semibold text-background'>
          {formatValue(value)}
        </span>
      </div>
      <div className='flex items-center justify-between gap-3 text-xs text-muted-foreground'>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        sliderSize='sm'
        onValueChange={([nextValue]) => {
          if (nextValue !== undefined) {
            onValueChange(nextValue);
          }
        }}
      />
    </div>
  );
}

function supportsSetting(
  model: SceneDialogueAudioModelChoiceReport | undefined,
  settings: SceneDialogueAudioVoiceSettings,
  key: keyof SceneDialogueAudioVoiceSettings
): boolean {
  if (!model) {
    return key in settings;
  }
  return key in model.defaultVoiceSettings || key in settings;
}

function formatOutputFormat(format: string): string {
  const mp3Match = /^mp3_(\d+)_(\d+)$/.exec(format);
  if (mp3Match) {
    const sampleRate = Number(mp3Match[1]);
    const bitrate = Number(mp3Match[2]);
    return `MP3 ${(sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1)} kHz (${bitrate}kbps)`;
  }
  return format
    .split('_')
    .map((part) => part.toUpperCase())
    .join(' ');
}

function formatLanguageCode(languageCode: string): string {
  const supportedOption = supportedLanguageOverrideOptions.find(
    (option) => option.value === languageCode
  );
  return supportedOption?.label ?? languageCode.toUpperCase();
}

function normalizeLanguageCode(languageCode: string | null): string | null {
  const normalizedCode = languageCode?.trim().split('-')[0]?.toLowerCase();
  return normalizedCode || null;
}
