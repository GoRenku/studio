import type { Scene, StudioSelection } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { sceneDisplayLabel } from '../scene-label';

export function SectionSceneList({
  scenes,
  onSelect,
}: {
  scenes: Scene[];
  onSelect: (selection: StudioSelection) => void;
}) {
  if (!scenes.length) {
    return (
      <p className='rounded-lg border border-dashed border-border/50 px-5 py-10 text-center text-sm text-muted-foreground'>
        This Section has no Scenes.
      </p>
    );
  }

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
      {scenes.map((scene) => (
        <Button
          key={scene.id}
          type='button'
          variant='ghost'
          onClick={() => onSelect({ type: 'scene', id: scene.id })}
          className='h-auto min-h-24 items-start justify-start whitespace-normal rounded-lg border border-border/45 bg-muted/15 p-4 text-left hover:border-item-active-border hover:bg-item-hover-bg'
        >
          <span className='min-w-0'>
            <span className='block text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>
              Scene
            </span>
            <span className='mt-2 block text-sm font-semibold leading-5 text-foreground'>
              {sceneDisplayLabel(scene)}
            </span>
            <span className='mt-1 block line-clamp-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground'>
              {scene.heading}
            </span>
          </span>
        </Button>
      ))}
    </div>
  );
}
