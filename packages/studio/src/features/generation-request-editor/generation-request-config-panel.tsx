import type {
  GenerationPreviewConfigurationValue,
  GenerationPreviewResource,
} from '@gorenku/studio-core/client';

export function GenerationRequestConfigPanel({
  preview,
}: {
  preview: GenerationPreviewResource;
}) {
  const rows = preview.configuration.sections.flatMap((section) =>
    section.rows.map((row) => ({ sectionKey: section.key, row }))
  );
  if (!rows.length) {
    return <p className='text-sm text-muted-foreground'>No settings.</p>;
  }
  return (
    <section
      aria-label='Saved generation configuration'
      className='mx-auto grid w-full max-w-[538px] gap-[18px] pt-[38px] pb-12'
    >
      {rows.map(({ sectionKey, row }) => {
        const displayValue = row.valueLabel ?? formatConfigurationValue(row.value);
        return (
          <div
            key={`${sectionKey}:${row.key}`}
            className='grid min-h-9 grid-cols-[150px_minmax(0,360px)] items-center gap-7'
          >
            <span className='text-xs font-medium text-muted-foreground'>
              {row.label}
            </span>
            <div
              className='flex h-9 min-w-0 items-center rounded-md border border-input bg-input/30 px-3 text-sm text-foreground shadow-xs'
              title={displayValue}
            >
              <span className='truncate'>{displayValue}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function formatConfigurationValue(value: GenerationPreviewConfigurationValue): string {
  if (value === null) return 'Not set';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return `${value.width} × ${value.height}`;
  return String(value);
}
