import type { ReactNode } from 'react';
import type {
  SceneDialogueAudioCastVoiceOption,
  SceneDialogueAudioModelChoice,
  SceneDialogueAudioModelChoiceReport,
} from '@gorenku/studio-core/client';
import { Alert, AlertDescription } from '@/ui/alert';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import type { SceneDialogueAudioDraft } from './use-scene-dialogue-audio';
import { SceneDialogueTaggedTextEditor } from './scene-dialogue-tagged-text-editor';

interface SceneDialogueAudioDialogTabProps {
  blockedIssue: string | null;
  draft: SceneDialogueAudioDraft;
  disabled: boolean;
  models: SceneDialogueAudioModelChoiceReport[];
  nonV3: boolean;
  selectedVoice: SceneDialogueAudioCastVoiceOption | null;
  usableVoices: SceneDialogueAudioCastVoiceOption[];
  onModelChange: (modelChoice: SceneDialogueAudioModelChoice) => void;
  onDraftChange: (patch: Partial<SceneDialogueAudioDraft>) => void;
}

export function SceneDialogueAudioDialogTab({
  blockedIssue,
  draft,
  disabled,
  models,
  nonV3,
  selectedVoice,
  usableVoices,
  onModelChange,
  onDraftChange,
}: SceneDialogueAudioDialogTabProps) {
  return (
    <div className='flex flex-col gap-4'>
      <PanelField label='Model'>
        <Select
          value={draft.modelChoice}
          onValueChange={(value) =>
            onModelChange(value as SceneDialogueAudioModelChoice)
          }
          disabled={disabled}
        >
          <SelectTrigger aria-label='Model' className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {models.map((model) => (
                <SelectItem key={model.modelChoice} value={model.modelChoice}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </PanelField>

      <PanelField label='Voice'>
        <Select
          value={draft.castVoiceId}
          onValueChange={(castVoiceId) => onDraftChange({ castVoiceId })}
          disabled={disabled || usableVoices.length === 0}
        >
          <SelectTrigger aria-label='Voice' className='w-full'>
            <SelectValue placeholder='Choose voice' />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {usableVoices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {formatVoiceReferenceName(voice.name)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {selectedVoice?.purpose ? (
          <p className='rounded-md border border-border/40 bg-panel-header-bg/60 px-3 py-2 text-xs leading-5 text-muted-foreground'>
            {selectedVoice.purpose}
          </p>
        ) : null}
      </PanelField>

      <PanelField label='Dialog Text'>
        <SceneDialogueTaggedTextEditor
          label='Dialog Text'
          value={nonV3 ? draft.plainText : draft.v3Text}
          disabled={disabled}
          highlightTags={!nonV3}
          onChange={(value) =>
            nonV3
              ? onDraftChange({ plainText: value })
              : onDraftChange({ v3Text: value })
          }
        />
      </PanelField>

      {blockedIssue ? (
        <Alert
          variant='destructive'
          className='border-destructive/30 bg-destructive/10 px-3 py-2'
        >
          <AlertDescription className='text-xs leading-5'>
            {blockedIssue}
          </AlertDescription>
        </Alert>
      ) : nonV3 ? (
        <Alert className='border-primary/30 bg-primary/10 px-3 py-2'>
          <AlertDescription className='text-xs leading-5 text-muted-foreground'>
            Audio tags and V3 delivery controls only work with Eleven v3. This
            model will generate from plain text.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function PanelField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className='flex flex-col gap-2'>
      <span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {label}
      </span>
      {children}
    </div>
  );
}

function formatVoiceReferenceName(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
