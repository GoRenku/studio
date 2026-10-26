import { castingLookTone, CASTING_TONE_CLASS_NAMES } from '@/features/casting-views/casting-tones';
import { sceneSummary } from '@/features/casting-views/scene-labels';
import type { SceneStripScene } from '@/features/casting-views/scene-strip';
import { cn } from '@/lib/utils';
import type { CastCastingLookResponse } from '@/services/studio-project-contracts';

const TICK_EVERY = 50;

/**
 * One thin cell per scene in screenplay order, colored by the Look that covers it. The picked Look's
 * scenes stay bright and the rest dim; with a costume picked, its scenes stay bright and the Look's
 * other scenes fade halfway. Hovering a cell names its scene and Look.
 */
export function LookSceneBar({
  scenes,
  looks,
  pickedLookId,
  highlightSceneIds,
}: {
  scenes: SceneStripScene[];
  looks: CastCastingLookResponse[];
  pickedLookId: string;
  /** The picked costume's scenes. */
  highlightSceneIds?: string[];
}) {
  const highlighted = highlightSceneIds ? new Set(highlightSceneIds) : null;
  const lookIndexByScene = new Map<string, number>();
  looks.forEach((look, index) => look.sceneIds.forEach((sceneId) => lookIndexByScene.set(sceneId, index)));
  const picked = looks.find((look) => look.id === pickedLookId);
  return (
    <div className='flex flex-col gap-1.5'>
      <div
        role='img'
        aria-label={picked ? `${picked.name}: ${sceneSummary(picked.sceneIds, scenes)}` : 'Scenes'}
        className='flex h-3.5 overflow-hidden rounded'
      >
        {scenes.map((scene) => {
          const lookIndex = lookIndexByScene.get(scene.id);
          const look = lookIndex === undefined ? undefined : looks[lookIndex];
          return (
            <span
              key={scene.id}
              title={look ? `Scene ${scene.label} · ${look.name}` : `Scene ${scene.label}`}
              className={cn(
                'min-w-0 flex-1',
                look ? CASTING_TONE_CLASS_NAMES[castingLookTone(lookIndex!)] : 'bg-muted',
                look && look.id !== pickedLookId ? 'opacity-30' : null,
                look?.id === pickedLookId && highlighted && !highlighted.has(scene.id) ? 'opacity-60' : null
              )}
            />
          );
        })}
      </div>
      <div aria-hidden='true' className='relative h-3 font-mono text-[10px] text-muted-foreground'>
        {sceneTicks(scenes).map((tick) => (
          <span key={tick.label} className='absolute' style={tick.style}>{tick.label}</span>
        ))}
      </div>
    </div>
  );
}

/** The first scene, every fiftieth, and the last; a fiftieth too close to the last is left out. */
function sceneTicks(scenes: SceneStripScene[]): Array<{ label: string; style: { left?: string; right?: string; transform?: string } }> {
  if (scenes.length === 0) return [];
  const last = scenes.length - 1;
  const middle = scenes.flatMap((scene, index) =>
    (index + 1) % TICK_EVERY === 0 && last - index > scenes.length / 20 ? [{ index, label: scene.label }] : []
  );
  return [
    { label: scenes[0]!.label, style: { left: '0' } },
    ...middle.map((tick) => ({ label: tick.label, style: { left: `${((tick.index + 0.5) / scenes.length) * 100}%`, transform: 'translateX(-50%)' } })),
    ...(last > 0 ? [{ label: scenes[last]!.label, style: { right: '0' } }] : []),
  ];
}
