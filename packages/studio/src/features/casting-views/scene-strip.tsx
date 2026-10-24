import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { CASTING_TONE_CLASS_NAMES, type CastingTone } from './casting-tones';

export interface SceneStripScene {
  id: string;
  label: string;
}

export interface SceneStripRow {
  sceneIds: string[];
  name: string;
  tone: CastingTone;
  highlighted?: boolean;
}

export interface SceneStripBand {
  label: string;
  rows: SceneStripRow[];
}

interface SceneStripProps {
  scenes: SceneStripScene[];
  bands: SceneStripBand[];
  onSceneClick?: (bandLabel: string, sceneId: string) => void;
  className?: string;
}

interface SceneStripCell {
  scenes: SceneStripScene[];
  row: SceneStripRow | null;
}

const LABEL_COLUMN_PX = 110;
const SCENE_COLUMN_MIN_PX = 38;

/** One column per scene in screenplay order; each band merges a row's run of neighbouring scenes into one cell. */
export function SceneStrip({ scenes, bands, onSceneClick, className }: SceneStripProps) {
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `${LABEL_COLUMN_PX}px repeat(${scenes.length}, minmax(${SCENE_COLUMN_MIN_PX}px, 1fr))`,
    minWidth: LABEL_COLUMN_PX + scenes.length * (SCENE_COLUMN_MIN_PX + 3),
  };
  return (
    <div className={cn('overflow-x-auto pb-1', className)}>
      <div className='grid gap-[3px] text-[11px]' style={gridStyle}>
        <BandLabel>Scene</BandLabel>
        {scenes.map((scene) => (
          <span key={scene.id} className='rounded-[5px] bg-muted py-[3px] text-center font-mono text-muted-foreground'>
            {scene.label}
          </span>
        ))}
        {bands.map((band) => (
          <SceneStripBandRow key={band.label} band={band} scenes={scenes} onSceneClick={onSceneClick} />
        ))}
      </div>
    </div>
  );
}

function SceneStripBandRow({
  band,
  scenes,
  onSceneClick,
}: {
  band: SceneStripBand;
  scenes: SceneStripScene[];
  onSceneClick?: (bandLabel: string, sceneId: string) => void;
}) {
  return (
    <>
      <BandLabel>{band.label}</BandLabel>
      {sceneStripCells(scenes, band.rows).map((cell) => (
        <div
          key={cell.scenes[0]!.id}
          title={cell.row?.name}
          style={{ gridColumn: `span ${cell.scenes.length}` }}
          className={cn(
            'relative min-h-[28px] overflow-hidden rounded-md',
            cell.row
              ? cn('px-[5px] py-1.5 text-center font-semibold', CASTING_TONE_CLASS_NAMES[cell.row.tone])
              : 'border border-dashed border-border/40',
            cell.row?.highlighted ? 'ring-2 ring-inset ring-primary' : null
          )}
        >
          {cell.row ? <span className='block truncate'>{cell.row.name}</span> : null}
          {onSceneClick ? (
            <span className='absolute inset-0 flex'>
              {cell.scenes.map((scene) => (
                <Button
                  key={scene.id}
                  type='button'
                  variant='ghost'
                  aria-label={`${band.label} · Scene ${scene.label}`}
                  className='h-full flex-1 rounded-none p-0 hover:bg-primary/20'
                  onClick={() => onSceneClick(band.label, scene.id)}
                />
              ))}
            </span>
          ) : null}
        </div>
      ))}
    </>
  );
}

function BandLabel({ children }: { children: string }) {
  return (
    <span className='self-center text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground'>
      {children}
    </span>
  );
}

/** Splits the scene columns into runs that share the same row; scenes no row covers stay single empty cells. */
function sceneStripCells(scenes: SceneStripScene[], rows: SceneStripRow[]): SceneStripCell[] {
  const cells: SceneStripCell[] = [];
  scenes.forEach((scene) => {
    const row = rows.find((candidate) => candidate.sceneIds.includes(scene.id)) ?? null;
    const previous = cells[cells.length - 1];
    if (row && previous?.row === row) {
      previous.scenes.push(scene);
      return;
    }
    cells.push({ scenes: [scene], row });
  });
  return cells;
}
