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

interface GenerationRequestControlsPanelProps {
  controls: GenerationEditorControl[];
  disabled: boolean;
  onChange: (
    controlId: string,
    value: GenerationPreviewConfigurationValue,
  ) => void;
}

export function GenerationRequestControlsPanel({
  controls,
  disabled,
  onChange,
}: GenerationRequestControlsPanelProps) {
  if (!controls.length) {
    return <p className='text-sm text-muted-foreground'>No settings.</p>;
  }
  return (
    <section className='overflow-hidden rounded-xl border border-border/40 bg-muted/40'>
      <h3 className='border-b border-border/40 bg-panel-header-bg px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        Generation
      </h3>
      <div className='divide-y divide-border/20'>
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
                value={String(control.value)}
                disabled={disabled}
                onValueChange={(value) => onChange(control.controlId, value)}
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
                value={control.value}
                min={control.min}
                max={control.max}
                step={control.step}
                disabled={disabled}
                onChange={(event) =>
                  onChange(control.controlId, Number(event.target.value))
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
