import { useState } from 'react';
import type { GenerationReviewControls, GenerationReviewField } from '@gorenku/studio-codex/client';
import type { JsonValue } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';
import { Textarea } from '@/ui/textarea';

interface ControlProps {
  field: GenerationReviewField;
  value: JsonValue | undefined;
  disabled: boolean;
  onChange: (value: JsonValue | undefined) => void;
}

export function GenerationReviewConfiguration({ controls, values, disabled, onChange }: {
  controls: GenerationReviewControls;
  values: Record<string, JsonValue>;
  disabled: boolean;
  onChange: (key: string, value: JsonValue | undefined) => void;
}) {
  return (
    <div className='mx-auto grid w-full max-w-[790px] gap-6 py-6'>
      {controls.groups.map((group, index) => (
        <fieldset key={index} disabled={disabled} className='grid gap-4'>
          <legend className='mb-3 text-sm font-medium'>{group.label}</legend>
          {group.fields.map((field) => (
            <GenerationReviewControl key={field.key} field={field} value={values[field.key]} disabled={disabled} onChange={(value) => onChange(field.key, value)} />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function GenerationReviewControl(props: ControlProps) {
  const Renderer = renderers[props.field.kind];
  return (
    <div className='grid gap-2'>
      <p className='text-sm font-medium'>{props.field.label}</p>
      {props.field.description ? <p className='text-xs text-muted-foreground'>{props.field.description}</p> : null}
      <Renderer {...props} />
      {props.field.nullable || props.value === null ? <div className='flex gap-2'>
        {props.field.nullable ? <Button variant='ghost' size='sm' disabled={props.disabled} onClick={() => props.onChange(null)}>Use null</Button> : null}
        {props.value === null ? <span className='self-center text-xs text-muted-foreground'>Null</span> : null}
      </div> : null}
    </div>
  );
}

function TextControl({ field, value, disabled, onChange }: ControlProps) {
  return <Input aria-label={field.label} disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} />;
}

function MultilineControl({ field, value, disabled, onChange }: ControlProps) {
  return <Textarea aria-label={field.label} disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} />;
}

function NumberControl({ field, value, disabled, onChange }: ControlProps) {
  return <Input aria-label={field.label} type='number' disabled={disabled} min={field.minimum} max={field.maximum} step={field.step ?? (field.kind === 'integer' ? 1 : 'any')} value={typeof value === 'number' ? value : ''} onChange={(event) => {
    if (event.target.value === '') onChange(undefined);
    else if (Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber);
  }} />;
}

function BooleanControl({ field, value, disabled, onChange }: ControlProps) {
  return <Switch aria-label={field.label} disabled={disabled} checked={value === true} onCheckedChange={onChange} />;
}

function EnumControl({ field, value, disabled, onChange }: ControlProps) {
  const index = field.options?.findIndex((option) => JSON.stringify(option.value) === JSON.stringify(value)) ?? -1;
  return (
    <Select value={index >= 0 ? String(index) : ''} disabled={disabled} onValueChange={(selected) => onChange(field.options![Number(selected)]!.value)}>
      <SelectTrigger aria-label={field.label}><SelectValue placeholder='Choose a value' /></SelectTrigger>
      <SelectContent>
        {field.options?.map((option, optionIndex) => <SelectItem key={optionIndex} value={String(optionIndex)}><span>{option.label}</span>{option.description ? <span className='ml-2 text-xs text-muted-foreground'>{option.description}</span> : null}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function MultiEnumControl({ field, value, disabled, onChange }: ControlProps) {
  const selections = Array.isArray(value) ? value : [];
  return <div className='grid gap-2'>{field.options?.map((option, index) => (
    <div key={index} className='flex items-center gap-2'>
      <Switch aria-label={`${field.label}: ${option.label}`} disabled={disabled} checked={selections.some((entry) => JSON.stringify(entry) === JSON.stringify(option.value))} onCheckedChange={(checked) => onChange(checked ? [...selections, option.value] : selections.filter((entry) => JSON.stringify(entry) !== JSON.stringify(option.value)))} />
      <span className='text-sm'>{option.label}{option.description ? <span className='ml-2 text-xs text-muted-foreground'>{option.description}</span> : null}</span>
    </div>
  ))}</div>;
}

function ObjectControl({ field, value, disabled, onChange }: ControlProps) {
  const properties = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return <div className='grid gap-3 border-l pl-4'>{field.properties?.map((property) => (
    <GenerationReviewControl key={property.key} field={property} value={properties[property.key]} disabled={disabled} onChange={(next) => {
      const updated = { ...properties };
      if (next === undefined) delete updated[property.key];
      else updated[property.key] = next;
      onChange(updated);
    }} />
  ))}</div>;
}

function ArrayControl({ field, value, disabled, onChange }: ControlProps) {
  const [draft, setDraft] = useState(() => ({ value, text: value === undefined ? '' : JSON.stringify(value, null, 2) }));
  const [error, setError] = useState<string>();
  const text = value === draft.value ? draft.text : value === undefined ? '' : JSON.stringify(value, null, 2);
  return <>
    <Textarea aria-label={field.label} disabled={disabled} value={text} onChange={(event) => {
      if (event.target.value === '') {
        setDraft({ value: undefined, text: '' });
        onChange(undefined);
        setError(undefined);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(event.target.value);
        if (!Array.isArray(parsed)) throw new Error('Enter a JSON array.');
        setDraft({ value: parsed as JsonValue[], text: event.target.value });
        onChange(parsed as JsonValue[]);
        setError(undefined);
      } catch {
        setDraft({ value: event.target.value, text: event.target.value });
        onChange(event.target.value);
        setError('Enter a valid JSON array before submitting.');
      }
    }} />
    {error && value === draft.value ? <p role='alert' className='text-sm text-destructive'>{error}</p> : null}
  </>;
}

const renderers = {
  text: TextControl, multiline: MultilineControl, number: NumberControl, integer: NumberControl,
  boolean: BooleanControl, enum: EnumControl, 'multi-enum': MultiEnumControl, object: ObjectControl, array: ArrayControl,
};
