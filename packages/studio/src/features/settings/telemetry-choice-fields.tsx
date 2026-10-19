import { ExternalLink, Info } from 'lucide-react';
import {
  HEARD_ABOUT_RENKU_ANSWERS,
  HEARD_ABOUT_RENKU_ANSWER_LABELS,
  TELEMETRY_FIELD_LIST_URL,
  type HeardAboutRenkuAnswer,
  type TelemetryBlock,
} from '@gorenku/studio-core/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';

const BLOCKED_NOTES: Record<TelemetryBlock, string> = {
  DO_NOT_TRACK: 'Nothing is sent while DO_NOT_TRACK is set on this computer.',
  RENKU_TELEMETRY_DISABLED: 'Nothing is sent while RENKU_TELEMETRY_DISABLED is set.',
  CI: 'Nothing is sent while Renku runs in CI.',
};

const SWITCH_ID = 'usage-statistics-switch';
const HEARD_ABOUT_ID = 'usage-statistics-heard-about';

export interface TelemetryChoiceFieldsProps {
  enabled: boolean;
  blockedBy: TelemetryBlock | null;
  disabled?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Present only on the first-run step; Settings does not ask. */
  heardAbout?: {
    answer: HeardAboutRenkuAnswer | null;
    onAnswerChange: (answer: HeardAboutRenkuAnswer) => void;
  };
}

export function TelemetryChoiceFields({
  enabled,
  blockedBy,
  disabled = false,
  onEnabledChange,
  heardAbout,
}: TelemetryChoiceFieldsProps) {
  return (
    <div className='space-y-3'>
      <div className='overflow-hidden rounded-xl border border-border/45 bg-card/20 shadow-sm'>
        <div className='flex items-center justify-between gap-6 px-6 py-5'>
          <label htmlFor={SWITCH_ID} className='text-[15px] font-medium leading-6 text-foreground'>
            Share usage statistics
          </label>
          <Switch
            id={SWITCH_ID}
            checked={enabled}
            disabled={disabled}
            onCheckedChange={onEnabledChange}
          />
        </div>
        {enabled && blockedBy ? (
          <p className='-mt-2 flex items-center gap-2 px-6 pb-4 text-sm text-muted-foreground'>
            <Info className='h-3.5 w-3.5 shrink-0' />
            {BLOCKED_NOTES[blockedBy]}
          </p>
        ) : null}
        {enabled && heardAbout ? (
          <div className='flex items-center justify-between gap-6 border-t border-border/30 px-6 py-5'>
            <label htmlFor={HEARD_ABOUT_ID} className='text-[15px] font-medium leading-6 text-foreground'>
              Where did you hear about Renku?{' '}
              <span className='font-normal text-muted-foreground'>(optional)</span>
            </label>
            <Select
              value={heardAbout.answer ?? undefined}
              disabled={disabled}
              onValueChange={(value) => heardAbout.onAnswerChange(value as HeardAboutRenkuAnswer)}
            >
              <SelectTrigger id={HEARD_ABOUT_ID} className='w-[280px] shrink-0'>
                <SelectValue placeholder='Choose an answer' />
              </SelectTrigger>
              <SelectContent>
                {HEARD_ABOUT_RENKU_ANSWERS.map((answer) => (
                  <SelectItem key={answer} value={answer}>
                    {HEARD_ABOUT_RENKU_ANSWER_LABELS[answer]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <a
        href={TELEMETRY_FIELD_LIST_URL}
        target='_blank'
        rel='noreferrer'
        className='inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4'
      >
        See every field Renku sends
        <ExternalLink className='h-3.5 w-3.5' />
      </a>
    </div>
  );
}
