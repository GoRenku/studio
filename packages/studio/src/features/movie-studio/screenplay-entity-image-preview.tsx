import { cn } from '@/lib/utils';

export function ScreenplayEntityImagePreview({
  kind,
  label,
  imageUrl,
}: {
  kind: 'castMember' | 'location';
  label: string;
  imageUrl: string;
}) {
  const roleLabel = kind === 'castMember' ? 'profile image' : 'hero image';
  return (
    <figure
      data-screenplay-entity-preview
      data-screenplay-entity-preview-kind={kind}
      className='overflow-hidden rounded-md border-2 border-muted-foreground/70 bg-popover shadow-xl'
    >
      <img
        src={imageUrl}
        alt={`${label} ${roleLabel}`}
        className={cn(
          'block object-cover',
          kind === 'castMember' ? 'aspect-square w-40' : 'aspect-video w-64'
        )}
      />
    </figure>
  );
}
