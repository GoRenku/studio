import type {
  CameraAngleId,
  FocusId,
  LensId,
  LocationAzimuthViewId,
  MoveDirectionId,
  MoveTrackId,
  RigId,
  ShotCameraDesign,
  ShotMovementId,
  ShotSizeId,
  SubjectFramingId,
} from './scene-shot-list.js';

// Canonical display labels for the structured camera-design vocabularies (0036).
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

export const LOCATION_AZIMUTH_VIEW_LABELS: Record<LocationAzimuthViewId, string> = {
  front: 'Front',
  right: 'Right',
  back: 'Back',
  left: 'Left',
};

/**
 * Human-readable contract strings derived from the structured camera-design
 * selection (0036). These keep the existing free-text `SceneShot` fields
 * populated — they remain the prompt-facing contract the skill already reads.
 * Each value is `undefined` when nothing is selected so callers can omit the
 * field (the schema requires non-empty strings).
 */
export interface DerivedCameraDesignStrings {
  shotType?: string;
  cameraAngle?: string;
  framing?: string;
  lensIntent?: string;
  cameraMovement?: string;
}

export function deriveCameraDesignStrings(
  design: ShotCameraDesign | undefined
): DerivedCameraDesignStrings {
  if (!design) {
    return {};
  }
  return {
    shotType: design.shotSize ? SHOT_SIZE_LABELS[design.shotSize] : undefined,
    cameraAngle: deriveCameraAngle(design),
    framing: deriveFraming(design),
    lensIntent: deriveLensIntent(design),
    cameraMovement: deriveCameraMovement(design),
  };
}

function deriveCameraAngle(design: ShotCameraDesign): string | undefined {
  const parts: string[] = [];
  if (design.cameraAngle) {
    parts.push(CAMERA_ANGLE_LABELS[design.cameraAngle]);
  }
  if (design.dutch) {
    parts.push(`Dutch ${design.dutch}`);
  }
  return parts.length ? parts.join(', ') : undefined;
}

function deriveFraming(design: ShotCameraDesign): string | undefined {
  const parts: string[] = [];
  for (const id of design.subjectFraming ?? []) {
    parts.push(SUBJECT_FRAMING_LABELS[id]);
  }
  const custom = design.custom?.composition?.trim();
  if (custom) {
    parts.push(custom);
  }
  return parts.length ? parts.join(', ') : undefined;
}

function deriveLensIntent(design: ShotCameraDesign): string | undefined {
  const equipment = design.equipment;
  const parts: string[] = [];
  if (equipment?.lens) {
    const lensLabel = LENS_LABELS[equipment.lens];
    parts.push(
      equipment.lensMillimeters
        ? `${lensLabel} ${formatMillimeters(equipment.lensMillimeters)}`
        : lensLabel
    );
  }
  if (equipment?.focus) {
    parts.push(FOCUS_LABELS[equipment.focus]);
  }
  return parts.length ? parts.join(', ') : undefined;
}

function deriveCameraMovement(design: ShotCameraDesign): string | undefined {
  const movement = design.movement;
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
  const custom = design.custom?.movement?.trim();
  if (custom) {
    parts.push(custom);
  }
  return parts.length ? parts.join(', ') : undefined;
}

function formatMillimeters(value: number): string {
  return Number.isInteger(value) ? `${value}mm` : `${value.toFixed(1)}mm`;
}
