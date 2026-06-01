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
import { useShotCameraDesignContext } from './shot-camera-design-context';
import {
  CAMERA_ANGLE_OPTIONS,
  FOCUS_OPTIONS,
  LENS_OPTIONS,
  SHOT_SIZE_OPTIONS,
  SUBJECT_FRAMING_HEADCOUNT_IDS,
  SUBJECT_FRAMING_OPTIONS,
} from './scene-shot-design-vocabulary';

export function SceneShotCompositionTab() {
  const { design, update, status } = useShotCameraDesignContext();
  const equipment = design.equipment ?? {};

  const toggleShotSize = (id: string) =>
    update({
      ...design,
      shotSize:
        design.shotSize === id ? undefined : (id as ShotSizeId),
    });

  const toggleSubjectFraming = (raw: string) => {
    const id = raw as SubjectFramingId;
    const current = design.subjectFraming ?? [];
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
    update({ ...design, subjectFraming: next });
  };

  const toggleAngle = (id: string) =>
    update({
      ...design,
      cameraAngle:
        design.cameraAngle === id ? undefined : (id as CameraAngleId),
    });

  const setDutch = (value: 'left' | 'right' | undefined) =>
    update({ ...design, dutch: value });

  const toggleLens = (id: LensId) =>
    update({
      ...design,
      equipment: {
        ...equipment,
        lens: equipment.lens === id ? undefined : id,
        lensMillimeters:
          equipment.lens === id ? undefined : equipment.lensMillimeters,
      },
    });

  const setLensMillimeters = (value: string) => {
    const trimmed = value.trim();
    update({
      ...design,
      equipment: {
        ...equipment,
        lensMillimeters: trimmed ? Number(trimmed) : undefined,
      },
    });
  };

  const toggleFocus = (id: FocusId) => {
    const clearingRackFocus = equipment.focus === id && id === 'rack-focus';
    update({
      ...design,
      equipment: {
        ...equipment,
        focus: equipment.focus === id ? undefined : id,
      },
      movement: clearingRackFocus
        ? {
            ...design.movement,
            movement:
              design.movement?.movement === 'rack-focus'
                ? undefined
                : design.movement?.movement,
            secondary:
              design.movement?.secondary === 'rack-focus'
                ? undefined
                : design.movement?.secondary,
          }
        : design.movement,
    });
  };

  const setCustomComposition = (value: string) =>
    update({ ...design, custom: { ...design.custom, composition: value } });

  return (
    <div className='space-y-6 py-4'>
      <DesignSection title='1. Shot Size'>
        <OptionTileGroup
          ariaLabel='Shot size'
          options={SHOT_SIZE_OPTIONS}
          selectedIds={design.shotSize ? [design.shotSize] : []}
          onToggle={toggleShotSize}
        />
      </DesignSection>

      <DesignSection title='2. Subject Framing'>
        <OptionTileGroup
          ariaLabel='Subject framing'
          options={SUBJECT_FRAMING_OPTIONS}
          selectedIds={design.subjectFraming ?? []}
          onToggle={toggleSubjectFraming}
        />
      </DesignSection>

      <DesignSection title='3. Camera Angle / Height'>
        <OptionTileGroup
          ariaLabel='Camera angle and height'
          options={CAMERA_ANGLE_OPTIONS}
          selectedIds={design.cameraAngle ? [design.cameraAngle] : []}
          onToggle={toggleAngle}
        />
      </DesignSection>

      <DesignSection title='Dutch'>
        <div className='flex flex-wrap gap-2'>
          <PillToggle
            selected={!design.dutch}
            onClick={() => setDutch(undefined)}
          >
            None
          </PillToggle>
          <PillToggle
            selected={design.dutch === 'left'}
            onClick={() => setDutch('left')}
          >
            <RotateCcw className='h-3.5 w-3.5' />
            Left
          </PillToggle>
          <PillToggle
            selected={design.dutch === 'right'}
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
              selected={equipment.lens === option.id}
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
            value={equipment.lensMillimeters ?? ''}
            placeholder='mm'
            aria-label='Lens millimeters'
            disabled={!equipment.lens}
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
              selected={equipment.focus === option.id}
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
          value={design.custom?.composition ?? ''}
          onChange={setCustomComposition}
          status={status}
        />
      </DesignSection>
    </div>
  );
}
