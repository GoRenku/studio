import {
  CAMERA_ANGLE_LABELS,
  MOVEMENT_LABELS,
  RIG_LABELS,
  SHOT_SIZE_LABELS,
  SUBJECT_FRAMING_LABELS,
} from '@gorenku/studio-core/client';
import type {
  CameraAngleId,
  RigId,
  ShotMovementId,
  ShotSizeId,
  SubjectFramingId,
} from '@gorenku/studio-core/client';
import type { OptionTileItem } from '@/ui/option-tile-group';
import {
  shotDesignImageUrl,
  shotDesignMotionUrl,
} from './shot-design-asset-urls';

// Controlled tile lists for the camera-design tabs (0036). Display labels live
// in core (shared with prompt-string derivation); this module only attaches the
// bundled illustration/motion references. Asset filenames follow the
// `<category>-<id>` convention emitted by the generate-assets skill.

export interface ShotDesignTileOption<Id extends string> extends OptionTileItem {
  id: Id;
}

function fromLabels<Id extends string>(
  labels: Record<Id, string>,
  category: string,
  options: { motion?: boolean } = {}
): ShotDesignTileOption<Id>[] {
  return (Object.keys(labels) as Id[]).map((id) => ({
    id,
    label: labels[id],
    imageUrl: shotDesignImageUrl(`${category}-${id}.png`),
    videoUrl: options.motion
      ? shotDesignMotionUrl(`${category}-${id}.mp4`)
      : undefined,
  }));
}

export const SHOT_SIZE_OPTIONS: ShotDesignTileOption<ShotSizeId>[] = fromLabels(
  SHOT_SIZE_LABELS,
  'shot-size'
);

export const SUBJECT_FRAMING_OPTIONS: ShotDesignTileOption<SubjectFramingId>[] =
  fromLabels(SUBJECT_FRAMING_LABELS, 'subject');

export const CAMERA_ANGLE_OPTIONS: ShotDesignTileOption<CameraAngleId>[] =
  fromLabels(CAMERA_ANGLE_LABELS, 'angle');

export const MOVEMENT_OPTIONS: ShotDesignTileOption<ShotMovementId>[] =
  fromLabels(MOVEMENT_LABELS, 'movement', { motion: true });

export const RIG_OPTIONS: ShotDesignTileOption<RigId>[] = fromLabels(
  RIG_LABELS,
  'rig'
);

/**
 * Subject-framing headcount values are mutually exclusive (a shot is a single,
 * a two-shot, a three-shot, or a group). The remaining subject-framing ids
 * layer freely on top, so the Camera Framing tab enforces exclusivity only
 * within this subset.
 */
export const SUBJECT_FRAMING_HEADCOUNT_IDS: readonly SubjectFramingId[] = [
  'single',
  'two-shot',
  'three-shot',
  'group',
];
