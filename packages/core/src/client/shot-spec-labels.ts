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
