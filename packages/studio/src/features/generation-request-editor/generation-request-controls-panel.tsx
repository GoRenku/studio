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
    <section className='overflow-hidden rounded-xl border border-border/40 bg-muted/40'>
      <h3 className='border-b border-border/40 bg-panel-header-bg px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        Generation
      </h3>
      <div className='divide-y divide-border/20'>
        {model ? (
          <div className='grid grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)] items-center gap-4 px-4 py-2.5'>
            <span className='text-xs text-muted-foreground'>Model</span>
            <Select
              value={model.value}
              disabled={disabled}
              onValueChange={model.onChange}
            >
              <SelectTrigger aria-label='Model'>
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
            className='grid grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)] items-center gap-4 px-4 py-2.5'
          >
            <span className='text-xs text-muted-foreground'>
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
                <SelectTrigger aria-label={control.label}>
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
