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
  buildShotGroupingProjection,
  type TakeScopedShotGroupDraft,
} from './shot-video-take-grouping';

interface SceneShotRailProps {
  shots: SceneShot[];
  imagesByShotId: Record<string, ScreenplayImageReferenceWithHttp>;
  selectedShotId: string | null;
  railGroups?: TakeScopedShotGroupDraft[];
  onSelectShot: (shotId: string) => void;
  onCycleShotGroup?: (shotId: string) => void;
}

const GROUP_VARIANT_CLASS: Record<0 | 1, string> = {
  0: 'bg-primary/10',
  1: 'bg-accent/35',
};

interface RailSegment {
  key: string;
  groupId: string | null;
  variant: 0 | 1 | null;
  rows: Array<{ shot: SceneShot; index: number }>;
}

export function SceneShotRail({
  shots,
  imagesByShotId,
  selectedShotId,
  railGroups = [],
  onSelectShot,
  onCycleShotGroup,
}: SceneShotRailProps) {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!selectedShotId) return;
    const row = rowRefs.current.get(selectedShotId);
    row?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedShotId]);

  const segments = useMemo<RailSegment[]>(() => {
    const projection = buildShotGroupingProjection(shots, railGroups);
    const result: RailSegment[] = [];
    shots.forEach((shot, index) => {
      const entry = projection.entries[index];
      const groupId = entry.takeId;
      const previous = result[result.length - 1];
      if (groupId && previous && previous.groupId === groupId) {
        previous.rows.push({ shot, index });
        return;
      }
      result.push({
        key: groupId ?? `single-${shot.shotId}`,
        groupId,
        variant: entry.variant,
        rows: [{ shot, index }],
      });
    });
    return result;
  }, [railGroups, shots]);

  return (
    <aside
      className='h-full overflow-y-auto rounded-xl border border-border/40 bg-muted/40 p-2'
      aria-label='Shots'
    >
      <ul className={cn('flex flex-col', SCENE_SHOT_LAYOUT.railRowGapClass)}>
        {segments.map((segment) => (
          <li key={segment.key}>
            <div
              className={cn(
                'flex flex-col gap-1 rounded-lg',
                segment.groupId && segment.variant !== null
                  ? cn('p-1', GROUP_VARIANT_CLASS[segment.variant])
                  : ''
              )}
              data-group-id={segment.groupId ?? undefined}
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
                    selected={shot.shotId === selectedShotId}
                    onSelect={() => onSelectShot(shot.shotId)}
                    onCycleGroup={
                      onCycleShotGroup
                        ? () => onCycleShotGroup(shot.shotId)
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
