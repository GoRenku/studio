import { useState, type JSX } from 'react';
import type { NativeRequestControl } from '@gorenku/studio-codex/native-request-controls';
import type { JsonValue } from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Slider } from '@/ui/slider';
import { Switch } from '@/ui/switch';

const SEGMENTED_OPTION_LIMIT = 5;

interface PanelControlProps {
  control: NativeRequestControl;
  value: JsonValue | undefined;
  disabled: boolean;
  onChange: (value: JsonValue) => void;
}

/** Compact panel presentation of Native Request Controls, chosen by control shape only. */
export function PanelNativeControls(input: {
  controls: NativeRequestControl[];
  values: Record<string, JsonValue>;
  disabled: boolean;
  onChange: (key: string, value: JsonValue) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2.5', input.className)}>
      {input.controls.map((control) => {
        const Renderer = rendererFor(control);
        return (
          <span key={control.key} className='flex items-center gap-2.5 text-xs text-[var(--dd-muted-fg)]'>
            {control.label}
            <Renderer control={control} value={input.values[control.key]} disabled={input.disabled} onChange={(value) => input.onChange(control.key, value)} />
          </span>
        );
      })}
    </div>
  );
}

function rendererFor(control: NativeRequestControl): (props: PanelControlProps) => JSX.Element {
  if (control.kind === 'number' || control.kind === 'integer') {
    return control.minimum !== undefined && control.maximum !== undefined ? SliderControl : NumberControl;
  }
  if (control.kind === 'enum') {
    return (control.options?.length ?? 0) <= SEGMENTED_OPTION_LIMIT ? SegmentedControl : SelectControl;
  }
  return control.kind === 'boolean' ? BooleanControl : TextControl;
}

function controlStep(control: NativeRequestControl): number {
  if (control.step !== undefined) return control.step;
  if (control.kind === 'integer') return 1;
  return (control.maximum! - control.minimum!) / 100;
}

function decimalPlaces(value: number): number {
  const [coefficient, exponent = '0'] = String(value).split('e');
  return Math.max(0, (coefficient!.split('.')[1]?.length ?? 0) - Number(exponent));
}

function readout(value: number, step: number): string {
  const decimals = Math.max(decimalPlaces(step), decimalPlaces(value));
  // toFixed supports at most 100 decimal places; smaller values retain exponent notation.
  return decimals <= 100 ? value.toFixed(decimals) : String(value);
}

function SliderControl({ control, value, disabled, onChange }: PanelControlProps) {
  const step = controlStep(control);
  const current = typeof value === 'number' ? value : control.minimum!;
  return (
    <>
      <span className='w-[120px]'>
        <Slider
          appearance='compact'
          min={control.minimum}
          max={control.maximum}
          step={step}
          value={[current]}
          disabled={disabled}
          aria-label={control.label}
          onValueChange={([next]) => { if (next !== undefined) onChange(next); }}
        />
      </span>
      <span className='min-w-[30px] font-[family-name:var(--dd-font-mono)] text-[11px] font-medium tabular-nums text-[var(--dd-fg)]'>{readout(current, step)}</span>
    </>
  );
}

function NumberControl({ control, value, disabled, onChange }: PanelControlProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const committed = typeof value === 'number' ? String(value) : '';
  return (
    <Input
      aria-label={control.label}
      type='number'
      disabled={disabled}
      min={control.minimum}
      max={control.maximum}
      step={control.step ?? (control.kind === 'integer' ? 1 : 'any')}
      value={draft ?? committed}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next)) onChange(next);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className='h-7 w-[96px] text-xs'
    />
  );
}

function sameValue(left: JsonValue | undefined, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function SegmentedControl({ control, value, disabled, onChange }: PanelControlProps) {
  return (
    <span role='group' aria-label={control.label} className='inline-flex overflow-hidden rounded-lg border border-[var(--dd-border)] bg-[var(--dd-card)]'>
      {control.options!.map((option, index) => (
        <Button
          key={index}
          type='button'
          variant='ghost'
          aria-pressed={sameValue(value, option.value)}
          disabled={disabled}
          title={option.description}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-auto rounded-none px-2.5 py-1 text-[11.5px] font-medium text-[var(--dd-muted-fg)] shadow-none hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)] [&+&]:border-l [&+&]:border-[var(--dd-border)]',
            sameValue(value, option.value) && 'bg-[var(--dd-active)] font-semibold text-[var(--dd-fg)]',
          )}
        >
          {option.label}
        </Button>
      ))}
    </span>
  );
}

function SelectControl({ control, value, disabled, onChange }: PanelControlProps) {
  const index = control.options!.findIndex((option) => sameValue(value, option.value));
  return (
    <Select value={index >= 0 ? String(index) : ''} disabled={disabled} onValueChange={(selected) => onChange(control.options![Number(selected)]!.value)}>
      <SelectTrigger aria-label={control.label} className='h-7 w-[150px] text-xs'><SelectValue /></SelectTrigger>
      <SelectContent>
        {control.options!.map((option, optionIndex) => <SelectItem key={optionIndex} value={String(optionIndex)}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function BooleanControl({ control, value, disabled, onChange }: PanelControlProps) {
  return <Switch aria-label={control.label} disabled={disabled} checked={value === true} onCheckedChange={onChange} />;
}

function TextControl({ control, value, disabled, onChange }: PanelControlProps) {
  return <Input aria-label={control.label} disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className='h-7 w-[160px] text-xs' />;
}
