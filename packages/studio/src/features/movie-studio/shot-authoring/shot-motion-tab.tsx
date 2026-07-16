import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Circle,
  MoveHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type {
  MoveDirectionId,
  MoveTrackId,
  RigId,
  ShotMovementId,
} from '@gorenku/studio-core/client';
import { OptionTileGroup } from '@/ui/option-tile-group';
import {
  CustomFieldRow,
  DesignSection,
  PillToggle,
} from './shot-design-controls';
import { useShotDirection } from './shot-direction-context';
import { MOVEMENT_OPTIONS, RIG_OPTIONS } from './shot-design-vocabulary';

// Minimum tile width (px) for the Movement preview grid. The grid is
// responsive auto-fill, so this is the *minimum* — larger means bigger 16:9
// previews and fewer per row. Tweak this to resize the movement videos.
const MOVEMENT_TILE_MIN_WIDTH = 200;

const DIRECTION_OPTIONS: Array<{
  id: MoveDirectionId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'forward', label: 'Forward', icon: ArrowRight },
  { id: 'backward', label: 'Backward', icon: ArrowLeft },
  { id: 'left', label: 'Left', icon: ArrowLeft },
  { id: 'right', label: 'Right', icon: ArrowRight },
  { id: 'up', label: 'Up', icon: ArrowUp },
  { id: 'down', label: 'Down', icon: ArrowDown },
];

const TRACK_OPTIONS: Array<{
  id: MoveTrackId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'straight', label: 'Straight', icon: MoveHorizontal },
  { id: 'circular', label: 'Circular', icon: Circle },
];

export function ShotMotionTab() {
  const { direction, onChange } = useShotDirection();
  const composition = direction.composition ?? {};
  const movement = direction.motion ?? {};

  const toggleMovement = (id: string) =>
    onChange({
      ...direction,
      motion: {
        ...movement,
        movement:
          movement.movement === id ? undefined : (id as ShotMovementId),
      },
      composition:
        movement.movement !== id && id === 'rack-focus'
          ? {
              ...composition,
              lens: { ...composition.lens, focus: 'rack-focus' },
            }
          : direction.composition,
    });

  const toggleDirection = (id: MoveDirectionId) => {
    const current = movement.directions ?? [];
    const next = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id];
    onChange({ ...direction, motion: { ...movement, directions: next } });
  };

  const toggleTrack = (id: MoveTrackId) =>
    onChange({
      ...direction,
      motion: {
        ...movement,
        track: movement.track === id ? undefined : id,
      },
    });

  const toggleRig = (id: string) =>
    onChange({
      ...direction,
      motion: {
        ...movement,
        rig: movement.rig === id ? undefined : (id as RigId),
      },
    });

  const setCustomMotion = (value: string) =>
    onChange({ ...direction, motion: { ...movement, customMotion: value } });

  return (
    <div className='space-y-6 py-4'>
      <DesignSection title='Movement'>
        <OptionTileGroup
          ariaLabel='Camera movement'
          options={MOVEMENT_OPTIONS}
          minTileWidth={MOVEMENT_TILE_MIN_WIDTH}
          selectedIds={movement.movement ? [movement.movement] : []}
          onToggle={toggleMovement}
        />
      </DesignSection>

      <div className='flex flex-wrap gap-x-10 gap-y-6'>
        <DesignSection title='Direction'>
          <div className='flex flex-wrap gap-2'>
            {DIRECTION_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <PillToggle
                  key={option.id}
                  ariaLabel={option.label}
                  selected={(movement.directions ?? []).includes(option.id)}
                  onClick={() => toggleDirection(option.id)}
                >
                  <Icon className='h-3.5 w-3.5' />
                  {option.label}
                </PillToggle>
              );
            })}
          </div>
        </DesignSection>

        <DesignSection title='Track'>
          <div className='flex flex-wrap gap-2'>
            {TRACK_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <PillToggle
                  key={option.id}
                  ariaLabel={option.label}
                  selected={movement.track === option.id}
                  onClick={() => toggleTrack(option.id)}
                >
                  <Icon className='h-3.5 w-3.5' />
                  {option.label}
                </PillToggle>
              );
            })}
          </div>
        </DesignSection>
      </div>

      <DesignSection title='Rig'>
        <OptionTileGroup
          ariaLabel='Camera rig'
          options={RIG_OPTIONS}
          aspect='square'
          selectedIds={movement.rig ? [movement.rig] : []}
          onToggle={toggleRig}
        />
      </DesignSection>

      <DesignSection title='Custom motion'>
        <CustomFieldRow
          placeholder='Custom motion…'
          value={movement.customMotion ?? ''}
          onChange={setCustomMotion}
        />
      </DesignSection>
    </div>
  );
}
