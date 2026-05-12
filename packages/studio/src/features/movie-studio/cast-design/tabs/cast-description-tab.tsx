import { Button } from '@/ui/button';
import { Textarea } from '@/ui/textarea';
import type {
  CastDescriptionContent,
  CastDesignAsset,
} from '../cast-design-types';

interface CastDescriptionTabProps {
  content: CastDescriptionContent;
  onOpenDetails: (asset: CastDesignAsset) => void;
}

export function CastDescriptionTab({
  content,
  onOpenDetails,
}: CastDescriptionTabProps) {
  return (
    <div className='h-full min-h-0 overflow-y-auto p-5'>
      <div className='mx-auto flex max-w-5xl flex-col gap-6'>
        <section className='space-y-2'>
          <div>
            <h3 className='text-sm font-semibold text-foreground'>
              Description
            </h3>
            <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
              Character notes loaded from project data.
            </p>
          </div>
          <Textarea
            value={content.descriptionText || 'No cast description is attached yet.'}
            readOnly
            rows={9}
            className='min-h-[240px] w-full resize-none rounded-lg border border-border/50 bg-background/45 px-4 py-3 text-sm leading-relaxed shadow-inner outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25'
          />
        </section>

        <section className='space-y-3'>
          <div>
            <h3 className='text-sm font-semibold text-foreground'>
              Description Image
            </h3>
            <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
              Reference images attached to this cast member.
            </p>
          </div>
          <div className='grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4'>
            {content.descriptionImages.map((image) => (
              <Button
                key={image.id}
                type='button'
                variant='ghost'
                onClick={() => onOpenDetails(image)}
                className='group h-auto flex-col items-stretch justify-start gap-0 overflow-hidden whitespace-normal rounded-lg border border-border/45 bg-muted/35 p-0 text-left shadow-sm transition hover:border-primary/60 hover:bg-muted/55'
              >
                <span className='block aspect-[4/3] overflow-hidden bg-muted/70'>
                  <img
                    src={image.imageUrl}
                    alt=''
                    className='h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.015]'
                  />
                </span>
                <span className='block truncate border-t border-border/45 px-3 py-2 text-xs font-medium text-muted-foreground'>
                  {image.title}
                </span>
              </Button>
            ))}
            {content.descriptionImages.length === 0 ? (
              <p className='rounded-lg border border-dashed border-border/45 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground'>
                No description images attached yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
