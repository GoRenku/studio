import type {
  GenerationPreviewConfigurationRow,
  GenerationPreviewConfigurationSection,
  GenerationPreviewConfigurationValue,
  StudioGenerationPreview,
} from '@gorenku/studio-core/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

interface GenerationPreviewConfigPanelProps {
  preview: StudioGenerationPreview;
}

export function GenerationPreviewConfigPanel({
  preview,
}: GenerationPreviewConfigPanelProps) {
  const sections = preview.configuration.sections;
  if (!sections.length) {
    return <p className='text-sm text-muted-foreground'>No settings.</p>;
  }
  return (
    <div className='grid grid-cols-1 items-start gap-4 lg:grid-cols-2'>
      {sections.map((section) => (
        <ConfigSection key={section.key} section={section} />
      ))}
    </div>
  );
}

function ConfigSection({
  section,
}: {
  section: GenerationPreviewConfigurationSection;
}) {
  const secondary =
    section.rows.length > 0 &&
    section.rows.every((row) => row.emphasis === 'secondary');
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-border/40',
        secondary ? 'bg-muted/25' : 'bg-muted/40'
      )}
    >
      <h3
        className={cn(
          'border-b border-border/40 bg-panel-header-bg px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
          secondary ? 'text-muted-foreground/70' : 'text-muted-foreground'
        )}
      >
        {section.label}
      </h3>
      <div className='divide-y divide-border/20'>
        {section.rows.map((row) => (
          <ConfigRow key={row.key} row={row} />
        ))}
      </div>
    </section>
  );
}

function ConfigRow({ row }: { row: GenerationPreviewConfigurationRow }) {
  const secondary = row.emphasis === 'secondary';
  return (
    <div className='flex items-center justify-between gap-4 px-4 py-2'>
      <span
        className={cn(
          'shrink-0 text-xs',
          secondary ? 'text-muted-foreground/70' : 'text-muted-foreground'
        )}
      >
        {row.label}
      </span>
      <ConfigRowValue row={row} secondary={secondary} />
    </div>
  );
}

function ConfigRowValue({
  row,
  secondary,
}: {
  row: GenerationPreviewConfigurationRow;
  secondary: boolean;
}) {
  const label = row.valueLabel ?? formatConfigurationValue(row.value);
  const identifier =
    typeof row.value === 'string' && row.valueLabel && row.valueLabel !== row.value
      ? row.value
      : null;
  const value = identifier ? (
    <span className='flex min-w-0 flex-col items-end gap-0.5 text-right'>
      <span className='text-sm font-medium text-foreground'>{label}</span>
      <span className='break-all font-mono text-[11px] text-muted-foreground'>
        {identifier}
      </span>
    </span>
  ) : row.providerField ? (
    <span
      className={cn(
        'break-all rounded bg-muted/50 px-1.5 py-0.5 text-right font-mono text-xs',
        secondary ? 'text-muted-foreground' : 'text-foreground/90'
      )}
    >
      {label}
    </span>
  ) : (
    <span
      className={cn(
        'min-w-0 break-words text-right text-sm',
        secondary ? 'text-muted-foreground' : 'text-foreground'
      )}
    >
      {label}
    </span>
  );
  const metadata = rowMetadata(row);
  if (!metadata.length) {
    return value;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{value}</TooltipTrigger>
      <TooltipContent side='left'>
        <div className='flex flex-col gap-0.5'>
          {metadata.map((entry) => (
            <span key={entry.label}>
              {entry.label}{' '}
              <span className='font-mono'>{entry.value}</span>
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function rowMetadata(
  row: GenerationPreviewConfigurationRow
): Array<{ label: string; value: string }> {
  const metadata: Array<{ label: string; value: string }> = [];
  if (row.providerField) {
    metadata.push({ label: 'Provider field', value: row.providerField });
  }
  if (row.schemaDefaultLabel) {
    metadata.push({ label: 'Schema default', value: row.schemaDefaultLabel });
  }
  if (row.allowedValues?.length) {
    metadata.push({
      label: 'Allowed',
      value: row.allowedValues.map(formatConfigurationValue).join(', '),
    });
  }
  if (row.source === 'provider-default') {
    metadata.push({ label: 'Source', value: 'provider default' });
  }
  return metadata;
}

function formatConfigurationValue(
  value: GenerationPreviewConfigurationValue
): string {
  if (value === null) {
    return 'Not set';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return `${value.width} x ${value.height}`;
  }
  return String(value);
}
