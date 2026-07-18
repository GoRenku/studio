import type { GenerationSpec, JsonValue } from '@gorenku/studio-core/client';

interface ImageRevisionSourceRequestProps {
  spec: GenerationSpec | null;
}

export function ImageRevisionSourceRequest({
  spec,
}: ImageRevisionSourceRequestProps) {
  if (!spec) return null;
  const prompt = typeof spec.values.prompt === 'string'
    ? spec.values.prompt
    : null;
  const values = Object.entries(spec.values).filter(([key]) => key !== 'prompt');
  const modelIdentity = [spec.model?.provider, spec.model?.model]
    .filter(Boolean)
    .join(' / ');
  const identity = [spec.executionKind, modelIdentity]
    .filter(Boolean)
    .join(' · ');
  return (
    <section className='mx-6 mb-3 max-h-44 overflow-auto rounded-xl border border-border/40 bg-muted/30 px-4 py-3'>
      <div className='flex items-baseline justify-between gap-4'>
        <h3 className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          Original generation request
        </h3>
        {identity ? (
          <span className='font-mono text-[11px] text-muted-foreground'>
            {identity}
          </span>
        ) : null}
      </div>
      {prompt ? (
        <p className='mt-2 whitespace-pre-wrap text-sm text-foreground'>
          {prompt}
        </p>
      ) : null}
      {values.length ? (
        <dl className='mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs'>
          {values.map(([key, value]) => (
            <div key={key} className='contents'>
              <dt className='text-muted-foreground'>{key}</dt>
              <dd className='break-words font-mono text-foreground/90'>
                {formatValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {spec.references.length ? (
        <div className='mt-3 text-xs text-muted-foreground'>
          References:{' '}
          {spec.references.map(referenceLabel).join(', ')}
        </div>
      ) : null}
    </section>
  );
}

function formatValue(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function referenceLabel(
  selection: GenerationSpec['references'][number],
): string {
  return selection.reference.kind === 'project-file'
    ? selection.reference.projectRelativePath
    : `${selection.reference.assetId} / ${selection.reference.assetFileId}`;
}
