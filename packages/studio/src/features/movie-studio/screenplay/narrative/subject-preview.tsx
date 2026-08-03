import { useEffect, useState, type ReactElement } from 'react';
import type { ScreenplaySubject } from '@gorenku/studio-core/client';
import {
  readCastMemberResource,
  readLocationResource,
  readPropResource,
} from '@/services/studio-continuity-api';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';
import { cn } from '@/lib/utils';

interface SubjectPreviewResource {
  label: string;
  imageUrl: string | null;
}

export function SubjectPreview({
  projectName,
  subject,
  trigger,
}: {
  projectName: string;
  subject: ScreenplaySubject;
  trigger: ReactElement;
}) {
  const [resource, setResource] = useState<SubjectPreviewResource | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readSubjectPreview(projectName, subject)
      .then((nextResource) => {
        if (!cancelled) setResource(nextResource);
      })
      .catch(() => {
        if (!cancelled) setResource(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, subject]);

  if (!resource) return trigger;

  const roleLabel = subject.type === 'castMember' ? 'profile image' : 'hero image';
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side='right'
        align='center'
        className='max-w-none overflow-hidden border border-border/60 bg-popover p-0 shadow-xl'
      >
        {resource.imageUrl ? (
          <figure>
            <img
              src={resource.imageUrl}
              alt={`${resource.label} ${roleLabel}`}
              className={cn(
                'block object-cover',
                subject.type === 'castMember' ? 'aspect-square w-40' : 'aspect-video w-64'
              )}
            />
            <figcaption className='border-t border-border/50 px-3 py-2 text-xs font-medium text-foreground'>
              {resource.label}
            </figcaption>
          </figure>
        ) : (
          <span className='block px-3 py-2 text-xs font-medium text-foreground'>
            {resource.label}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

async function readSubjectPreview(
  projectName: string,
  subject: ScreenplaySubject
): Promise<SubjectPreviewResource> {
  if (subject.type === 'castMember') {
    const resource = await readCastMemberResource(projectName, subject.id);
    return {
      label: resource.castMember.name,
      imageUrl: resource.firstImage?.url ?? null,
    };
  }
  if (subject.type === 'location') {
    const resource = await readLocationResource(projectName, subject.id);
    return {
      label: resource.location.name,
      imageUrl: resource.firstImage?.url ?? null,
    };
  }
  const resource = await readPropResource(projectName, subject.id);
  return {
    label: resource.prop.name,
    imageUrl: resource.firstImage?.url ?? null,
  };
}
