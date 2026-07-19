import type {
  GenerationPreviewConfigurationValue,
  GenerationPreviewResource,
} from '@gorenku/studio-core/client';

export function GenerationRequestConfigPanel({
  preview,
}: {
  preview: GenerationPreviewResource;
}) {
  if (!preview.configuration.sections.length) {
    return <p className='text-sm text-muted-foreground'>No settings.</p>;
  }
  return (
    <div className='mx-auto w-full max-w-2xl space-y-6 py-2'>
      {preview.configuration.sections.map((section) => (
        <section key={section.key} className='space-y-3'>
          <h3 className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            {section.label}
          </h3>
          <div className='divide-y divide-border/50 rounded-md border bg-background'>
            {section.rows.map((row) => (
              <div key={row.key} className='flex items-center justify-between gap-6 px-4 py-3'>
                <span className='text-sm text-muted-foreground'>{row.label}</span>
                <span className='text-right text-sm font-medium'>
                  {row.valueLabel ?? formatConfigurationValue(row.value)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function formatConfigurationValue(value: GenerationPreviewConfigurationValue): string {
  if (value === null) return 'Not set';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return `${value.width} × ${value.height}`;
  return String(value);
}
