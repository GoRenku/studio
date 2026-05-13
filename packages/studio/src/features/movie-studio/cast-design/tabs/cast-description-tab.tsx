import { Button } from '@/ui/button';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { MarkdownAssetEditor } from '../../markdown-asset-editor';
import type {
  CastDescriptionContent,
  CastDesignAsset,
} from '../cast-design-types';

interface CastDescriptionTabProps {
  projectName: string;
  content: CastDescriptionContent;
  onOpenDetails: (asset: CastDesignAsset) => void;
  onProjectChange: (project: ProjectShellWithHttp) => void;
}

export function CastDescriptionTab({
  projectName,
  content,
  onOpenDetails,
  onProjectChange,
}: CastDescriptionTabProps) {
  return (
    <div className='h-full min-h-0 overflow-y-auto p-5'>
      <div className='mx-auto flex max-w-5xl flex-col gap-6'>
        <MarkdownAssetEditor
          projectName={projectName}
          label='Description'
          asset={content.descriptionAsset}
          initialContent={content.descriptionText}
          emptyMessage='No cast description is attached yet.'
          minHeightClassName='min-h-[240px]'
          onProjectChange={onProjectChange}
        />

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
