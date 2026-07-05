import type {
  GenerationPreviewConfigurationItem,
  StudioGenerationPreview,
} from '@gorenku/studio-core/client';
import { Badge } from '@/ui/badge';
import { formatEstimateUsd } from '../movie-studio/scenes/shot-video-take-production-projection';

interface GenerationPreviewConfigPanelProps {
  preview: StudioGenerationPreview;
}

export function GenerationPreviewConfigPanel({
  preview,
}: GenerationPreviewConfigPanelProps) {
  return (
    <div className='flex min-h-0 flex-col gap-4'>
      {preview.configuration.length ? (
        <div className='grid grid-cols-3 gap-2'>
          {preview.configuration.map((item) => (
            <ConfigCell
              key={item.key}
              label={item.label}
              value={formatConfigValue(item.value)}
            />
          ))}
        </div>
      ) : (
        <p className='text-sm text-muted-foreground'>
          No user-facing generator settings are included in this preview.
        </p>
      )}
      {preview.estimate ? <EstimateSummary preview={preview} /> : null}
    </div>
  );
}

function ConfigCell({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className='rounded-md border border-border/40 bg-card/40 px-3 py-2'>
      <p className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {label}
      </p>
      <p className='mt-1 break-words text-xs text-foreground'>
        {value === undefined || value === null || value === '' ? 'Not set' : String(value)}
      </p>
    </div>
  );
}

function EstimateSummary({
  preview,
}: {
  preview: StudioGenerationPreview;
}) {
  const estimate = preview.estimate;
  if (!estimate) {
    return null;
  }

  return (
    <div className='flex shrink-0 items-end justify-between gap-3 rounded-md border border-border/50 bg-panel-header-bg px-3 py-2.5'>
      <div className='flex flex-col gap-0.5'>
        <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          Estimated total
        </span>
        <span className='font-mono text-lg leading-none text-foreground'>
          {estimate.state === 'estimated'
            ? formatEstimateUsd(estimate.estimatedCostUsd)
            : estimate.state === 'unpriced'
              ? 'Unpriced'
              : 'Not estimated'}
        </span>
      </div>
      {estimate.warnings?.length ? (
        <Badge variant='outline' className='shrink-0'>
          {estimate.warnings.length === 1
            ? '1 warning'
            : `${estimate.warnings.length} warnings`}
        </Badge>
      ) : null}
    </div>
  );
}

function formatConfigValue(value: GenerationPreviewConfigurationItem['value']) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value;
}
