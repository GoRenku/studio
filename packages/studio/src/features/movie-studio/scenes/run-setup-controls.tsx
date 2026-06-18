import type { ReactNode } from 'react';
import type {
  ShotVideoTakeParameterReport,
  ShotVideoTakeParameterValue,
} from '@gorenku/studio-core/client';
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

/**
 * Run-setup parameter controls for the AI Production tab (0041). Each control is
 * its own small, prop-driven component; `RunSetupParameter` dispatches by the
 * core `ShotVideoTakeParameterReport` shape. No fetch, no hooks beyond props.
 */

interface ControlProps {
  parameter: ShotVideoTakeParameterReport;
  value: ShotVideoTakeParameterValue | undefined;
  onChange: (value: ShotVideoTakeParameterValue) => void;
  disabled?: boolean;
}

/** Vertical label + control field, matching the design-section micro-label tone. */
function RunSetupField({
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
  return `shot-video-take-parameter-${name}`;
}

export function RunSetupSelect({ parameter, value, onChange, disabled = false }: ControlProps) {
  const id = controlId(parameter.name);
  const allowed = parameter.allowedValues ?? [];
  return (
    <RunSetupField label={parameter.label} htmlFor={id} required={parameter.required}>
      <Select
        disabled={disabled}
        value={value === undefined || value === null ? undefined : String(value)}
        onValueChange={(next) => {
          const match = allowed.find((option) => String(option) === next);
          onChange(match ?? next);
        }}
      >
        <SelectTrigger id={id} size='sm' className='w-full'>
          <SelectValue placeholder='Select' />
        </SelectTrigger>
        <SelectContent>
          {allowed.map((option) => (
            <SelectItem key={String(option)} value={String(option)}>
              {String(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </RunSetupField>
  );
}

export function RunSetupToggle({ parameter, value, onChange, disabled = false }: ControlProps) {
  const id = controlId(parameter.name);
  return (
    <RunSetupField label={parameter.label} htmlFor={id} required={parameter.required} inline>
      <Switch
        id={id}
        disabled={disabled}
        checked={Boolean(value)}
        onCheckedChange={(checked) => onChange(checked)}
      />
    </RunSetupField>
  );
}

export function RunSetupNumber({ parameter, value, onChange, disabled = false }: ControlProps) {
  const id = controlId(parameter.name);
  return (
    <RunSetupField label={parameter.label} htmlFor={id} required={parameter.required}>
      <Input
        id={id}
        disabled={disabled}
        type='number'
        min={parameter.minimum}
        max={parameter.maximum}
        value={value === undefined || value === null ? '' : Number(value)}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
        }
        className='w-full'
      />
    </RunSetupField>
  );
}

export function RunSetupText({ parameter, value, onChange, disabled = false }: ControlProps) {
  const id = controlId(parameter.name);
  return (
    <RunSetupField label={parameter.label} htmlFor={id} required={parameter.required}>
      <Input
        id={id}
        disabled={disabled}
        type='text'
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
        className='w-full'
      />
    </RunSetupField>
  );
}

/** Pick the control component for a parameter based on its report shape. */
export function RunSetupParameter(props: ControlProps) {
  const { parameter, value } = props;
  if (parameter.allowedValues && parameter.allowedValues.length > 0) {
    return <RunSetupSelect {...props} />;
  }
  if (typeof value === 'boolean' || typeof parameter.defaultValue === 'boolean') {
    return <RunSetupToggle {...props} />;
  }
  if (typeof value === 'number' || typeof parameter.defaultValue === 'number') {
    return <RunSetupNumber {...props} />;
  }
  return <RunSetupText {...props} />;
}
