import { useEffect, useMemo, useRef } from 'react';
import type {
  SceneShot,
  ScreenplayImageReferenceWithHttp,
} from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import { SCENE_SHOT_LAYOUT } from './scene-shot-layout';
import { SceneShotRailRow } from './scene-shot-rail-row';
import { shotLabel } from './scene-shot-labels';
import {
  buildTakeShotSelectionProjection,
  findTakeShotSelectionForShot,
  type TakeShotSelectionDraft,
} from './shot-video-take-selection';

interface SceneShotRailProps {
  shots: SceneShot[];
  imagesByShotId: Record<string, ScreenplayImageReferenceWithHttp>;
  selectedShotId: string | null;
  railSelections?: TakeShotSelectionDraft[];
  onSelectShot: (shotId: string) => void;
  onChangeShotSelection?: (shotId: string) => void;
}

interface RailSegment {
  key: string;
  selectionId: string | null;
  rows: Array<{ shot: SceneShot; index: number }>;
}

export function SceneShotRail({
  shots,
  imagesByShotId,
  selectedShotId,
  railSelections = [],
  onSelectShot,
  onChangeShotSelection,
}: SceneShotRailProps) {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!selectedShotId) return;
    const row = rowRefs.current.get(selectedShotId);
    row?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedShotId]);

  const segments = useMemo<RailSegment[]>(() => {
    const projection = buildTakeShotSelectionProjection(shots, railSelections);
    const result: RailSegment[] = [];
    shots.forEach((shot, index) => {
      const entry = projection.entries[index];
      const selectionId = entry.takeId;
      const previous = result[result.length - 1];
      if (selectionId && previous && previous.selectionId === selectionId) {
        previous.rows.push({ shot, index });
        return;
      }
      result.push({
        key: selectionId ?? `single-${shot.shotId}`,
        selectionId,
        rows: [{ shot, index }],
      });
    });
    return result;
  }, [railSelections, shots]);

  return (
    <aside
      className='h-full overflow-y-auto rounded-xl border border-border/40 bg-muted/40 p-2'
      aria-label='Shots'
    >
      <ul className={cn('flex flex-col', SCENE_SHOT_LAYOUT.railRowGapClass)}>
        {segments.map((segment) => (
          <li key={segment.key}>
            <div
              className={cn('flex flex-col gap-1 rounded-lg')}
              data-selection-id={segment.selectionId ?? undefined}
            >
              {segment.rows.map(({ shot, index }) => (
                <div
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
                    focused={shot.shotId === selectedShotId}
                    selectedForEdit={Boolean(
                      findTakeShotSelectionForShot(railSelections, shot.shotId)
                    )}
                    selectionActionLabel={shotSelectionActionLabel({
                      shots,
                      selections: railSelections,
                      shotId: shot.shotId,
                    })}
                    onSelect={() => onSelectShot(shot.shotId)}
                    onChangeSelection={
                      onChangeShotSelection
                        ? () => onChangeShotSelection(shot.shotId)
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function shotSelectionActionLabel(input: {
  shots: SceneShot[];
  selections: TakeShotSelectionDraft[];
  shotId: string;
}): 'Select Shot' | 'Expand Select' | 'Stop Select' {
  if (findTakeShotSelectionForShot(input.selections, input.shotId)) {
    return 'Stop Select';
  }
  const index = input.shots.findIndex((shot) => shot.shotId === input.shotId);
  const previousShotId = input.shots[index - 1]?.shotId;
  const nextShotId = input.shots[index + 1]?.shotId;
  if (
    (previousShotId &&
      findTakeShotSelectionForShot(input.selections, previousShotId)) ||
    (nextShotId && findTakeShotSelectionForShot(input.selections, nextShotId))
  ) {
    return 'Expand Select';
  }
  return 'Select Shot';
}
