import {
  CAMERA_ANGLE_LABELS,
  FOCUS_LABELS,
  LENS_LABELS,
  MOVEMENT_LABELS,
  RIG_LABELS,
  SHOT_SIZE_LABELS,
  SUBJECT_FRAMING_LABELS,
} from '@gorenku/studio-core/client';
import type {
  CameraAngleId,
  FocusId,
  LensId,
  RigId,
  ShotMovementId,
  ShotSizeId,
  SubjectFramingId,
} from '@gorenku/studio-core/client';
import type { OptionTileItem } from '@/ui/option-tile-group';

const imageModules = import.meta.glob(
  './generated/images/*.{png,webp}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

const motionModules = import.meta.glob(
  './generated/motion/*.mp4',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

const imagesByName = indexByBasename(imageModules);
const motionByName = indexByBasename(motionModules);

export interface ShotDesignTileOption<Id extends string>
  extends OptionTileItem {
  id: Id;
}

export interface ShotDesignStill {
  kind: 'still';
  imageUrl: string;
}

export interface ShotDesignMotion {
  kind: 'motion';
  posterUrl: string;
  videoUrl: string;
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
  fromLabels(MOVEMENT_LABELS, 'movement', { motion: true }).map((option) =>
    option.id === 'rack-focus'
      ? {
          ...option,
          imageUrl: imagesByName['movement-rack-focus.webp'],
          videoUrl: undefined,
        }
      : option
  );

export const RIG_OPTIONS: ShotDesignTileOption<RigId>[] = fromLabels(
  RIG_LABELS,
  'rig'
);

export const LENS_OPTIONS: Array<{ id: LensId; label: string }> =
  Object.entries(LENS_LABELS).map(([id, label]) => ({
    id: id as LensId,
    label,
  }));

export const FOCUS_OPTIONS: Array<{ id: FocusId; label: string }> =
  Object.entries(FOCUS_LABELS).map(([id, label]) => ({
    id: id as FocusId,
    label,
  }));

export const SUBJECT_FRAMING_HEADCOUNT_IDS: readonly SubjectFramingId[] = [
  'single',
  'two-shot',
  'three-shot',
  'group',
];

export function getShotSizeMedia(value: string): ShotDesignStill | null {
  return stillFromOption(SHOT_SIZE_OPTIONS.find((option) => option.id === value));
}

export function getCameraAngleMedia(value: string): ShotDesignStill | null {
  return stillFromOption(
    CAMERA_ANGLE_OPTIONS.find((option) => option.id === value)
  );
}

export function getShotMovementMedia(
  value: string
): ShotDesignMotion | ShotDesignStill | null {
  const option = MOVEMENT_OPTIONS.find((candidate) => candidate.id === value);
  if (!option?.imageUrl) {
    return null;
  }
  return option.videoUrl
    ? {
        kind: 'motion',
        posterUrl: option.imageUrl,
        videoUrl: option.videoUrl,
      }
    : { kind: 'still', imageUrl: option.imageUrl };
}

function fromLabels<Id extends string>(
  labels: Record<Id, string>,
  category: string,
  options: { motion?: boolean } = {}
): ShotDesignTileOption<Id>[] {
  return (Object.keys(labels) as Id[]).map((id) => ({
    id,
    label: labels[id],
    imageUrl: imagesByName[`${category}-${id}.png`],
    videoUrl: options.motion
      ? motionByName[`${category}-${id}.mp4`]
      : undefined,
  }));
}

function stillFromOption(
  option: OptionTileItem | undefined
): ShotDesignStill | null {
  return option?.imageUrl
    ? { kind: 'still', imageUrl: option.imageUrl }
    : null;
}

function indexByBasename(
  modules: Record<string, string>
): Record<string, string> {
  const byName: Record<string, string> = {};
  for (const [path, url] of Object.entries(modules)) {
    byName[path.slice(path.lastIndexOf('/') + 1)] = url;
  }
  return byName;
}
