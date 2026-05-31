import { useEffect, useRef } from 'react';
import type {
  SceneShot,
  ScreenplayImageReferenceWithHttp,
} from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import { SCENE_SHOT_LAYOUT } from './scene-shot-layout';
import { SceneShotRailRow } from './scene-shot-rail-row';
import { shotLabel } from './scene-shot-labels';

interface SceneShotRailProps {
  shots: SceneShot[];
  imagesByShotId: Record<string, ScreenplayImageReferenceWithHttp>;
  selectedShotId: string | null;
  onSelectShot: (shotId: string) => void;
}

export function SceneShotRail({
  shots,
  imagesByShotId,
  selectedShotId,
  onSelectShot,
}: SceneShotRailProps) {
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    if (!selectedShotId) return;
    const row = rowRefs.current.get(selectedShotId);
    row?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedShotId]);

  return (
    <aside
      className='shrink-0 overflow-y-auto rounded-xl border border-border/40 bg-muted/40 p-2'
      style={{ width: `${SCENE_SHOT_LAYOUT.railWidthPx}px` }}
      aria-label='Shots'
    >
      <ul className={cn('flex flex-col', SCENE_SHOT_LAYOUT.railRowGapClass)}>
        {shots.map((shot, index) => (
          <li
            key={shot.shotId}
            ref={(node) => {
              if (node) {
                rowRefs.current.set(shot.shotId, node);
              } else {
                rowRefs.current.delete(shot.shotId);
              }
            }}
          >
            <SceneShotRailRow
              label={shotLabel(index)}
              title={shot.title}
              image={imagesByShotId[shot.shotId]}
              selected={shot.shotId === selectedShotId}
              onSelect={() => onSelectShot(shot.shotId)}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}
