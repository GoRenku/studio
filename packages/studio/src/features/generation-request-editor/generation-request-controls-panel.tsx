import type {
  GenerationEditorControl,
  GenerationPreviewConfigurationValue,
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

interface GenerationRequestControlsPanelProps {
  controls: GenerationEditorControl[];
  disabled: boolean;
  model?: {
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
  };
  onChange: (
    controlId: string,
    value: GenerationPreviewConfigurationValue,
  ) => void;
}

export function GenerationRequestControlsPanel({
  controls,
  disabled,
  model,
  onChange,
}: GenerationRequestControlsPanelProps) {
  if (!controls.length && !model) {
    return <p className='text-sm text-muted-foreground'>No settings.</p>;
  }
  return (
    <section className='mx-auto grid w-full max-w-[538px] gap-[18px] pt-[38px] pb-12'>
      <div className='contents'>
        {model ? (
          <div className='grid min-h-9 grid-cols-[150px_360px] items-center gap-7'>
            <span className='text-xs font-medium text-muted-foreground'>Model</span>
            <Select
              value={model.value}
              disabled={disabled}
              onValueChange={model.onChange}
            >
              <SelectTrigger aria-label='Model' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {model.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {controls.map((control) => (
          <div
            key={control.controlId}
            className='grid min-h-9 grid-cols-[150px_360px] items-center gap-7'
          >
            <span className='text-xs font-medium text-muted-foreground'>
              {control.label}
            </span>
            {control.kind === 'select' ? (
              <Select
                value={
                  control.value === null ? undefined : String(control.value)
                }
                disabled={disabled}
                onValueChange={(value) =>
                  onChange(
                    control.controlId,
                    control.options.find(
                      (option) => String(option.value) === value
                    )?.value ?? value
                  )
                }
              >
                <SelectTrigger aria-label={control.label} className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {control.options.map((option) => (
                    <SelectItem
                      key={String(option.value)}
                      value={String(option.value)}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : control.kind === 'number' ? (
              <Input
                aria-label={control.label}
                type='number'
                value={control.value ?? ''}
                min={control.min}
                max={control.max}
                step={control.step}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    control.controlId,
                    event.target.value === '' ? null : Number(event.target.value)
                  )
                }
              />
            ) : control.kind === 'toggle' ? (
              <Switch
                aria-label={control.label}
                checked={control.value}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange(control.controlId, checked)
                }
              />
            ) : control.kind === 'text' ? (
              <Input
                aria-label={control.label}
                type='text'
                value={control.value ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  onChange(control.controlId, event.target.value)
                }
              />
            ) : (
              <span className='text-right text-sm text-foreground'>
                {String(control.value)}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
