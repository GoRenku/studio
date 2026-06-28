import type {
  CameraAngleId,
  FocusId,
  LensId,
  MoveDirectionId,
  MoveTrackId,
  RigId,
  ShotMovementId,
  ShotSizeId,
  SubjectFramingId,
} from './scene-shot-list.js';
import type { SceneShotVideoTakeDirection } from './shot-video-take.js';

// Canonical display labels for the structured shot specs vocabularies (0036).
// These are the single source of truth shared by the prompt-string derivation
// (server write path) and the Studio tile UI, so the same term never drifts.

export const SHOT_SIZE_LABELS: Record<ShotSizeId, string> = {
  'extreme-close-up': 'Extreme Close-Up',
  'close-up': 'Close-Up',
  'medium-close-up': 'Medium Close-Up',
  'medium-shot': 'Medium Shot',
  'medium-full-shot': 'Medium Full',
  'full-shot': 'Full Shot',
  'wide-shot': 'Wide Shot',
  'extreme-wide-shot': 'Extreme Wide',
  'establishing-shot': 'Establishing Shot',
};

export const SUBJECT_FRAMING_LABELS: Record<SubjectFramingId, string> = {
  single: 'Single',
  'two-shot': 'Two-Shot',
  'three-shot': 'Three-Shot',
  group: 'Group',
  'over-the-shoulder': 'Over Shoulder',
  'over-the-hip': 'Over Hip',
  'point-of-view': 'Point of View',
  insert: 'Insert',
  reaction: 'Reaction',
};

export const CAMERA_ANGLE_LABELS: Record<CameraAngleId, string> = {
  'ground-level': 'Ground-Level',
  'knee-level': 'Knee-Level',
  'hip-level': 'Hip-Level',
  'shoulder-level': 'Shoulder-Level',
  'eye-level': 'Eye-Level',
  'low-angle': 'Low Angle',
  'high-angle': 'High Angle',
  overhead: 'Overhead',
};

export const MOVEMENT_LABELS: Record<ShotMovementId, string> = {
  static: 'Static',
  pan: 'Pan',
  tilt: 'Tilt',
  'swish-pan': 'Swish Pan',
  'swish-tilt': 'Swish Tilt',
  tracking: 'Tracking',
  'push-in': 'Push In',
  'pull-out': 'Pull Out',
  zoom: 'Zoom',
  'rack-focus': 'Rack Focus',
};

export const MOVE_DIRECTION_LABELS: Record<MoveDirectionId, string> = {
  forward: 'Forward',
  backward: 'Backward',
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down',
};

export const MOVE_TRACK_LABELS: Record<MoveTrackId, string> = {
  straight: 'Straight',
  circular: 'Circular',
};

export const RIG_LABELS: Record<RigId, string> = {
  sticks: 'Tripod',
  'hand-held': 'Handheld',
  gimbal: 'Gimbal',
  slider: 'Slider',
  jib: 'Jib',
  drone: 'Drone',
  dolly: 'Dolly',
  steadicam: 'Steadicam',
  crane: 'Crane',
};

export const LENS_LABELS: Record<LensId, string> = {
  'ultra-wide': 'Ultra-Wide',
  wide: 'Wide',
  normal: 'Normal',
  'short-tele': 'Short Telephoto',
  tele: 'Telephoto',
  macro: 'Macro',
};

export const FOCUS_LABELS: Record<FocusId, string> = {
  'deep-focus': 'Deep Focus',
  'shallow-focus': 'Shallow Focus',
  'rack-focus': 'Rack Focus',
  'tilt-shift': 'Tilt-Shift',
};

/**
 * Human-readable contract strings derived from the structured take direction
 * selection (0036). These keep the existing free-text `SceneShot` fields
 * populated — they remain the prompt-facing contract the skill already reads.
 * Each value is `undefined` when nothing is selected so callers can omit the
 * field (the schema requires non-empty strings).
 */
export interface DerivedTakeDirectionPromptStrings {
  shotType?: string;
  cameraAngle?: string;
  framing?: string;
  lensIntent?: string;
  cameraMovement?: string;
}

export function deriveTakeDirectionPromptStrings(
  direction: SceneShotVideoTakeDirection | undefined
): DerivedTakeDirectionPromptStrings {
  if (!direction) {
    return {};
  }
  return {
    shotType: direction.composition?.shotSize
      ? SHOT_SIZE_LABELS[direction.composition.shotSize]
      : undefined,
    cameraAngle: deriveCameraAngle(direction),
    framing: deriveFraming(direction),
    lensIntent: deriveLensIntent(direction),
    cameraMovement: deriveCameraMovement(direction),
  };
}

function deriveCameraAngle(
  direction: SceneShotVideoTakeDirection
): string | undefined {
  const parts: string[] = [];
  if (direction.composition?.cameraAngle) {
    parts.push(CAMERA_ANGLE_LABELS[direction.composition.cameraAngle]);
  }
  if (direction.composition?.dutch) {
    parts.push(`Dutch ${direction.composition.dutch}`);
  }
  return parts.length ? parts.join(', ') : undefined;
}

function deriveFraming(
  direction: SceneShotVideoTakeDirection
): string | undefined {
  const parts: string[] = [];
  for (const id of direction.composition?.subjectFraming ?? []) {
    parts.push(SUBJECT_FRAMING_LABELS[id]);
  }
  const custom = direction.composition?.customComposition?.trim();
  if (custom) {
    parts.push(custom);
  }
  return parts.length ? parts.join(', ') : undefined;
}

function deriveLensIntent(
  direction: SceneShotVideoTakeDirection
): string | undefined {
  const lens = direction.composition?.lens;
  const parts: string[] = [];
  if (lens?.type) {
    const lensLabel = LENS_LABELS[lens.type];
    parts.push(
      lens.millimeters
        ? `${lensLabel} ${formatMillimeters(lens.millimeters)}`
        : lensLabel
    );
  }
  if (lens?.focus) {
    parts.push(FOCUS_LABELS[lens.focus]);
  }
  return parts.length ? parts.join(', ') : undefined;
}

function deriveCameraMovement(
  direction: SceneShotVideoTakeDirection
): string | undefined {
  const movement = direction.motion;
  const parts: string[] = [];
  if (movement?.movement) {
    parts.push(MOVEMENT_LABELS[movement.movement]);
  }
  if (movement?.secondary) {
    parts.push(`+ ${MOVEMENT_LABELS[movement.secondary]}`);
  }
  if (movement?.directions?.length) {
    parts.push(
      movement.directions
        .map((id) => MOVE_DIRECTION_LABELS[id].toLowerCase())
        .join('/')
    );
  }
  if (movement?.track) {
    parts.push(`${MOVE_TRACK_LABELS[movement.track].toLowerCase()} track`);
  }
  if (movement?.rig) {
    parts.push(`on ${RIG_LABELS[movement.rig].toLowerCase()}`);
  }
  const custom = direction.motion?.customMotion?.trim();
  if (custom) {
    parts.push(custom);
  }
  return parts.length ? parts.join(', ') : undefined;
}

function formatMillimeters(value: number): string {
  return Number.isInteger(value) ? `${value}mm` : `${value.toFixed(1)}mm`;
}
