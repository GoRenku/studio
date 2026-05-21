import { useEffect, useState } from 'react';
import type { Clip } from '@gorenku/studio-core/client';
import { readClipDesignResource } from '@/services/studio-project-assets-api';

interface ClipDesignPanelProps {
  projectName: string;
  clip: Clip;
}

export function ClipDesignPanel({
  projectName,
  clip,
}: ClipDesignPanelProps) {
  const [resource, setResource] = useState<Awaited<
    ReturnType<typeof readClipDesignResource>
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readClipDesignResource(projectName, clip.id)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResource(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clip.id, projectName]);

  const editableClip = resource?.clip.id === clip.id ? resource.clip : clip;

  return (
    <div className='space-y-4'>
      <section className='space-y-3'>
        <h3 className='text-sm font-semibold text-foreground'>Clip Brief</h3>
        {editableClip.summary ? (
          <p className='min-h-24 whitespace-pre-wrap rounded-md border border-border/45 bg-muted/25 p-4 text-sm leading-relaxed text-foreground'>
            {editableClip.summary}
          </p>
        ) : (
          <p className='rounded-md border border-dashed border-border/45 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground'>
            No clip brief has been written yet.
          </p>
        )}
      </section>

      <div className='grid grid-cols-1 xl:grid-cols-3 gap-3'>
        {['Design References', 'Shot Design', 'Motion Design'].map((stage) => (
          <section
            key={stage}
            className='overflow-hidden rounded-lg border border-border/40 bg-card shadow-lg'
          >
            <div className='h-[42px] border-b border-border/40 bg-muted/35 px-4 flex items-center'>
              <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
                {stage}
              </h3>
            </div>
            <div className='p-4 space-y-3'>
              <div className='flex aspect-video items-center justify-center rounded-md border border-border/40 bg-muted/40 text-xs text-muted-foreground'>
                Empty
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
