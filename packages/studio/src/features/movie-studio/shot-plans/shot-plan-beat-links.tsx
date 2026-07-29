import { Image } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/ui/hover-card';
import type { StudioShotPlanCoveredBeat } from '@/services/studio-shot-plans-contracts';

export function ShotPlanBeatLinks({
  coveredBeats,
}: {
  coveredBeats: StudioShotPlanCoveredBeat[];
}) {
  return (
    <div
      role='group'
      aria-label='Covered Beats'
      className='flex flex-wrap gap-2'
    >
      {coveredBeats.map((coveredBeat) => {
        const label = `Beat ${coveredBeat.position + 1}`;
        return coveredBeat.storyboardImage ? (
          <HoverCard key={coveredBeat.beat.id} openDelay={180}>
            <HoverCardTrigger asChild>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                className='h-7 gap-1.5 rounded-full bg-muted/45 px-3 text-[11px] text-muted-foreground hover:text-foreground'
              >
                {label}
                <Image className='h-3 w-3' />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className='w-72'>
              <img
                src={coveredBeat.storyboardImage.url}
                alt={`Storyboard image for ${label}`}
                className='aspect-video w-full rounded-sm object-cover'
              />
            </HoverCardContent>
          </HoverCard>
        ) : (
          <span
            key={coveredBeat.beat.id}
            className='inline-flex h-7 items-center rounded-full border border-border/50 bg-muted/45 px-3 text-[11px] text-muted-foreground'
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
