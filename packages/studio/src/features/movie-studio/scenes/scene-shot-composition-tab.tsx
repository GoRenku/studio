import { RotateCcw, RotateCw } from 'lucide-react';
import type {
  CameraAngleId,
  FocusId,
  LensId,
  ShotSizeId,
  SubjectFramingId,
} from '@gorenku/studio-core/client';
import { Input } from '@/ui/input';
import { OptionTileGroup } from '@/ui/option-tile-group';
import {
  CustomFieldRow,
  DesignSection,
  PillToggle,
} from './scene-shot-design-controls';
import { useShotSpecsContext } from './shot-specs-context';
import {
  CAMERA_ANGLE_OPTIONS,
  FOCUS_OPTIONS,
  LENS_OPTIONS,
  SHOT_SIZE_OPTIONS,
  SUBJECT_FRAMING_HEADCOUNT_IDS,
  SUBJECT_FRAMING_OPTIONS,
} from './scene-shot-design-vocabulary';

export function SceneShotCompositionTab() {
  const { shotSpecs, update } = useShotSpecsContext();
  const lens = shotSpecs.lens ?? {};

  const toggleShotSize = (id: string) =>
    update({
      ...shotSpecs,
      shotSize:
        shotSpecs.shotSize === id ? undefined : (id as ShotSizeId),
    });

  const toggleSubjectFraming = (raw: string) => {
    const id = raw as SubjectFramingId;
    const current = shotSpecs.subjectFraming ?? [];
    let next: SubjectFramingId[];
    if (current.includes(id)) {
      next = current.filter((value) => value !== id);
    } else if (SUBJECT_FRAMING_HEADCOUNT_IDS.includes(id)) {
      // Headcount values are mutually exclusive; replace any existing one.
      next = [
        ...current.filter(
          (value) => !SUBJECT_FRAMING_HEADCOUNT_IDS.includes(value)
        ),
        id,
      ];
    } else {
      next = [...current, id];
    }
    update({ ...shotSpecs, subjectFraming: next });
  };

  const toggleAngle = (id: string) =>
    update({
      ...shotSpecs,
      cameraAngle:
        shotSpecs.cameraAngle === id ? undefined : (id as CameraAngleId),
    });

  const setDutch = (value: 'left' | 'right' | undefined) =>
    update({ ...shotSpecs, dutch: value });

  const toggleLens = (id: LensId) =>
    update({
      ...shotSpecs,
      lens: {
        ...lens,
        type: lens.type === id ? undefined : id,
        millimeters:
          lens.type === id ? undefined : lens.millimeters,
      },
    });

  const setLensMillimeters = (value: string) => {
    const trimmed = value.trim();
    update({
      ...shotSpecs,
      lens: {
        ...lens,
        millimeters: trimmed ? Number(trimmed) : undefined,
      },
    });
  };

  const toggleFocus = (id: FocusId) => {
    const clearingRackFocus = lens.focus === id && id === 'rack-focus';
    update({
      ...shotSpecs,
      lens: {
        ...lens,
        focus: lens.focus === id ? undefined : id,
      },
      movement: clearingRackFocus
        ? {
            ...shotSpecs.movement,
            movement:
              shotSpecs.movement?.movement === 'rack-focus'
                ? undefined
                : shotSpecs.movement?.movement,
            secondary:
              shotSpecs.movement?.secondary === 'rack-focus'
                ? undefined
                : shotSpecs.movement?.secondary,
          }
        : shotSpecs.movement,
    });
  };

  const setCustomComposition = (value: string) =>
    update({ ...shotSpecs, custom: { ...shotSpecs.custom, composition: value } });

  return (
    <div className='space-y-6 py-4'>
      <DesignSection title='1. Shot Size'>
        <OptionTileGroup
          ariaLabel='Shot size'
          options={SHOT_SIZE_OPTIONS}
          selectedIds={shotSpecs.shotSize ? [shotSpecs.shotSize] : []}
          onToggle={toggleShotSize}
        />
      </DesignSection>

      <DesignSection title='2. Subject Framing'>
        <OptionTileGroup
          ariaLabel='Subject framing'
          options={SUBJECT_FRAMING_OPTIONS}
          selectedIds={shotSpecs.subjectFraming ?? []}
          onToggle={toggleSubjectFraming}
        />
      </DesignSection>

      <DesignSection title='3. Camera Angle / Height'>
        <OptionTileGroup
          ariaLabel='Camera angle and height'
          options={CAMERA_ANGLE_OPTIONS}
          selectedIds={shotSpecs.cameraAngle ? [shotSpecs.cameraAngle] : []}
          onToggle={toggleAngle}
        />
      </DesignSection>

      <DesignSection title='Dutch'>
        <div className='flex flex-wrap gap-2'>
          <PillToggle
            selected={!shotSpecs.dutch}
            onClick={() => setDutch(undefined)}
          >
            None
          </PillToggle>
          <PillToggle
            selected={shotSpecs.dutch === 'left'}
            onClick={() => setDutch('left')}
          >
            <RotateCcw className='h-3.5 w-3.5' />
            Left
          </PillToggle>
          <PillToggle
            selected={shotSpecs.dutch === 'right'}
            onClick={() => setDutch('right')}
          >
            <RotateCw className='h-3.5 w-3.5' />
            Right
          </PillToggle>
        </div>
      </DesignSection>

      <DesignSection title='4. Lens Intent'>
        <div className='flex flex-wrap items-center gap-2'>
          {LENS_OPTIONS.map((option) => (
            <PillToggle
              key={option.id}
              selected={lens.type === option.id}
              onClick={() => toggleLens(option.id)}
            >
              {option.label}
            </PillToggle>
          ))}
          <Input
            type='number'
            min={1}
            max={300}
            step={1}
            value={lens.millimeters ?? ''}
            placeholder='mm'
            aria-label='Lens millimeters'
            disabled={!lens.type}
            onChange={(event) => setLensMillimeters(event.target.value)}
            className='h-8 w-24'
          />
        </div>
      </DesignSection>

      <DesignSection title='5. Focus / Depth of Field'>
        <div className='flex flex-wrap gap-2'>
          {FOCUS_OPTIONS.map((option) => (
            <PillToggle
              key={option.id}
              selected={lens.focus === option.id}
              onClick={() => toggleFocus(option.id)}
            >
              {option.label}
            </PillToggle>
          ))}
        </div>
      </DesignSection>

      <DesignSection title='6. Custom Composition'>
        <CustomFieldRow
          placeholder='Custom composition...'
          value={shotSpecs.custom?.composition ?? ''}
          onChange={setCustomComposition}
        />
      </DesignSection>
    </div>
  );
}
