import { useEffect, useState } from 'react';
import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs, TabsContent } from '@/ui/tabs';
import type { CastMemberResourceResponse } from '@/services/studio-project-contracts';
import { readCastMemberResource } from '@/services/studio-screenplay-api';
import { ScreenplayPrimaryImage } from '../screenplay-media/screenplay-primary-image';

interface CastMemberPanelProps {
  projectName: string;
  castMemberId: string;
}

export function CastMemberPanel({ projectName, castMemberId }: CastMemberPanelProps) {
  const [resource, setResource] = useState<CastMemberResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readCastMemberResource(projectName, castMemberId)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load cast member.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [castMemberId, projectName]);

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading cast member...</p>;
  }

  const castMember = resource.castMember;
  const fields = [
    ['Role', castMember.role],
    ['Age', castMember.age?.toString()],
    ['Want', castMember.want],
    ['Need', castMember.need],
  ].filter((field): field is [string, string] => Boolean(field[1]));

  return (
    <Tabs defaultValue='details' className='h-full gap-0'>
      <LineTabBar
        items={[
          { value: 'details', label: 'Details' },
          { value: 'visual', label: 'Visual Content' },
          { value: 'voice', label: 'Voice Design' },
        ]}
      />
      <TabsContent value='details' className='overflow-y-auto p-4'>
        <div className='grid gap-5 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)]'>
          <ScreenplayPrimaryImage
            image={resource.firstImage}
            label={castMember.name}
            placeholder='No cast image yet'
          />
          <div className='space-y-5'>
            {fields.length ? (
              <dl className='grid gap-3 sm:grid-cols-2'>
                {fields.map(([label, value]) => (
                  <div key={label} className='rounded-md border border-border/40 bg-card p-3'>
                    <dt className='text-[11px] uppercase tracking-[0.12em] text-muted-foreground'>
                      {label}
                    </dt>
                    <dd className='mt-1 text-sm'>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <TextSection title='Arc' text={castMember.arc} />
            <TextSection title='Description' text={castMember.description} />
            <TextSection title='Voice Notes' text={castMember.voiceNotes} />
          </div>
        </div>
      </TabsContent>
      <TabsContent value='visual' className='p-4 text-sm text-muted-foreground'>
        Visual content will appear here when project assets are attached.
      </TabsContent>
      <TabsContent value='voice' className='p-4 text-sm text-muted-foreground'>
        Voice design will appear here when project assets are attached.
      </TabsContent>
    </Tabs>
  );
}

function TextSection({ title, text }: { title: string; text?: string }) {
  if (!text) {
    return null;
  }
  return (
    <section className='space-y-2'>
      <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
        {title}
      </h3>
      <p className='whitespace-pre-wrap text-sm leading-6'>{text}</p>
    </section>
  );
}
