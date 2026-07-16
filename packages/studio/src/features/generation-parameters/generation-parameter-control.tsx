import type { ReactNode } from 'react';
import { Input } from '@/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { Switch } from '@/ui/switch';
import { cn } from '@/lib/utils';

export type GenerationParameterControlValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[]
  | { kind: 'dimensions'; width: number; height: number }
  | Record<string, unknown>;

export interface GenerationParameterControlReport {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: GenerationParameterControlValue;
  allowedValues?: GenerationParameterControlValue[];
  minimum?: number;
  maximum?: number;
}

export interface GenerationParameterControlProps {
  parameter: GenerationParameterControlReport;
  value: GenerationParameterControlValue | undefined;
  onChange?: (value: GenerationParameterControlValue) => void;
  disabled?: boolean;
}

function GenerationParameterField({
  label,
  htmlFor,
  required,
  inline,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  inline?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5',
        inline && 'flex-row items-center justify-between gap-3'
      )}
    >
      <label
        htmlFor={htmlFor}
        className='flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'
      >
        {label}
        {required ? <span className='text-primary'>•</span> : null}
      </label>
      {children}
    </div>
  );
}

function controlId(name: string): string {
  return `generation-parameter-${name}`;
}

function scalarValue(value: GenerationParameterControlValue | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'object') {
    return generationParameterValueLabel(value);
  }
  return String(value);
}

export function GenerationParameterSelect({
  parameter,
  value,
  onChange,
  disabled = false,
}: GenerationParameterControlProps) {
  const id = controlId(parameter.name);
  const allowed = parameter.allowedValues ?? [];
  return (
    <GenerationParameterField
      label={parameter.label}
      htmlFor={id}
      required={parameter.required}
    >
      <Select
        disabled={disabled}
        value={scalarValue(value)}
        onValueChange={(next) => {
          const match = allowed.find((option) => scalarValue(option) === next);
          onChange?.(match ?? next);
        }}
      >
        <SelectTrigger id={id} size='sm' className='w-full'>
          <SelectValue placeholder='Unspecified' />
        </SelectTrigger>
        <SelectContent>
          {allowed.map((option) => (
            <SelectItem key={generationParameterValueLabel(option)} value={scalarValue(option) ?? ''}>
              {generationParameterValueLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </GenerationParameterField>
  );
}

export function GenerationParameterToggle({
  parameter,
  value,
  onChange,
  disabled = false,
}: GenerationParameterControlProps) {
  const id = controlId(parameter.name);
  return (
    <GenerationParameterField
      label={parameter.label}
      htmlFor={id}
      required={parameter.required}
      inline
    >
      <Switch
        id={id}
        disabled={disabled}
        checked={Boolean(value)}
        onCheckedChange={(checked) => onChange?.(checked)}
      />
    </GenerationParameterField>
  );
}

export function GenerationParameterNumber({
  parameter,
  value,
  onChange,
  disabled = false,
}: GenerationParameterControlProps) {
  const id = controlId(parameter.name);
  return (
    <GenerationParameterField
      label={parameter.label}
      htmlFor={id}
      required={parameter.required}
    >
      <Input
        id={id}
        disabled={disabled}
        type='number'
        min={parameter.minimum}
        max={parameter.maximum}
        value={value === undefined || value === null ? '' : Number(value)}
        onChange={(event) =>
          onChange?.(event.target.value === '' ? null : Number(event.target.value))
        }
        className='w-full'
      />
    </GenerationParameterField>
  );
}

export function GenerationParameterText({
  parameter,
  value,
  onChange,
  disabled = false,
}: GenerationParameterControlProps) {
  const id = controlId(parameter.name);
  return (
    <GenerationParameterField
      label={parameter.label}
      htmlFor={id}
      required={parameter.required}
    >
      <Input
        id={id}
        disabled={disabled}
        type='text'
        value={value === undefined || value === null ? '' : generationParameterValueLabel(value)}
        onChange={(event) => onChange?.(event.target.value)}
        className='w-full'
      />
    </GenerationParameterField>
  );
}

export function GenerationParameterControl(props: GenerationParameterControlProps) {
  const { parameter, value } = props;
  if (parameter.allowedValues && parameter.allowedValues.length > 0) {
    return <GenerationParameterSelect {...props} />;
  }
  if (typeof value === 'boolean' || typeof parameter.defaultValue === 'boolean') {
    return <GenerationParameterToggle {...props} />;
  }
  if (typeof value === 'number' || typeof parameter.defaultValue === 'number') {
    return <GenerationParameterNumber {...props} />;
  }
  return <GenerationParameterText {...props} />;
}

function generationParameterValueLabel(
  value: GenerationParameterControlValue
): string {
  if (value === null) {
    return 'Not set';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (
    typeof value === 'object' &&
    (('kind' in value && value.kind === 'dimensions') || !('kind' in value)) &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  ) {
    return `${value.width} x ${value.height}`;
  }
  if (typeof value === 'object') {
    return 'Configured';
  }
  return String(value);
}
