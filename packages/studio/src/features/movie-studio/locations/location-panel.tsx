import { useEffect, useState } from 'react';
import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs, TabsContent } from '@/ui/tabs';
import type { LocationResourceResponse } from '@/services/studio-project-contracts';
import { readLocationResource } from '@/services/studio-screenplay-api';
import { ScreenplayPrimaryImage } from '../screenplay-media/screenplay-primary-image';

interface LocationPanelProps {
  projectName: string;
  locationId: string;
}

export function LocationPanel({ projectName, locationId }: LocationPanelProps) {
  const [resource, setResource] = useState<LocationResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readLocationResource(projectName, locationId)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load location.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locationId, projectName]);

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading location...</p>;
  }

  const location = resource.location;
  return (
    <Tabs defaultValue='details' className='h-full gap-0'>
      <LineTabBar
        items={[
          { value: 'details', label: 'Details' },
          { value: 'visual', label: 'Visual Content' },
        ]}
      />
      <TabsContent value='details' className='overflow-y-auto p-4'>
        <div className='grid gap-5 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)]'>
          <ScreenplayPrimaryImage
            image={resource.firstImage}
            label={location.name}
            placeholder='No location image yet'
          />
          <div className='space-y-5'>
            {location.timePeriod ? (
              <div className='rounded-md border border-border/40 bg-card p-3'>
                <div className='text-[11px] uppercase tracking-[0.12em] text-muted-foreground'>
                  Time Period
                </div>
                <div className='mt-1 text-sm'>{location.timePeriod}</div>
              </div>
            ) : null}
            <TextSection title='Description' text={location.description} />
            <TextSection title='Visual Notes' text={location.visualNotes} framed />
          </div>
        </div>
      </TabsContent>
      <TabsContent value='visual' className='p-4 text-sm text-muted-foreground'>
        Visual content will appear here when project assets are attached.
      </TabsContent>
    </Tabs>
  );
}

function TextSection({
  title,
  text,
  framed = false,
}: {
  title: string;
  text?: string;
  framed?: boolean;
}) {
  if (!text) {
    return null;
  }
  return (
    <section className={framed ? 'rounded-md border border-border/40 bg-card p-4' : 'space-y-2'}>
      <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
        {title}
      </h3>
      <p className='mt-2 whitespace-pre-wrap text-sm leading-6'>{text}</p>
    </section>
  );
}
