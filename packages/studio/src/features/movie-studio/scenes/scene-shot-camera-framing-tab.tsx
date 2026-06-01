import { RotateCcw, RotateCw } from 'lucide-react';
import type {
  CameraAngleId,
  ShotSizeId,
  SubjectFramingId,
} from '@gorenku/studio-core/client';
import { OptionTileGroup } from '@/ui/option-tile-group';
import {
  CustomFieldRow,
  DesignSection,
  PillToggle,
} from './scene-shot-design-controls';
import { useShotCameraDesignContext } from './shot-camera-design-context';
import {
  CAMERA_ANGLE_OPTIONS,
  SHOT_SIZE_OPTIONS,
  SUBJECT_FRAMING_HEADCOUNT_IDS,
  SUBJECT_FRAMING_OPTIONS,
} from './shot-design-vocabulary';

export function SceneShotCameraFramingTab() {
  const { design, update, status } = useShotCameraDesignContext();

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

  const setCustomFraming = (value: string) =>
    update({ ...design, custom: { ...design.custom, framing: value } });

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

      <DesignSection title='Custom framing'>
        <CustomFieldRow
          placeholder='Custom framing…'
          value={design.custom?.framing ?? ''}
          onChange={setCustomFraming}
          status={status}
        />
      </DesignSection>
    </div>
  );
}
