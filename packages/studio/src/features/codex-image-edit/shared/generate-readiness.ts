import type { ImageEditRegion, ImageEditSession } from '@gorenku/studio-codex/image-edit';
import type { RegionModeOption } from './region-list';

export interface ImageEditGenerateReadiness {
  ready: boolean;
  problem: boolean;
  message: string;
}

export function nextImageEditTakeNumber(session: ImageEditSession): number {
  return Math.max(0, ...session.versions.map((version) => version.takeNumber)) + 1;
}

/**
 * Mirrors the runtime's draft rules only to explain a disabled Generate; the Codex runtime
 * still validates every draft before recording an action.
 */
export function imageEditGenerateReadiness(input: {
  session: ImageEditSession;
  regions: ImageEditRegion[];
  wholeImageInstruction: string;
  modes: RegionModeOption[];
}): ImageEditGenerateReadiness {
  const { session } = input;
  if (session.action && session.action.status !== 'failed') {
    return { ready: false, problem: false, message: `Generating Take ${nextImageEditTakeNumber(session)}…` };
  }
  if (!session.editBaseAssetFileId) {
    return { ready: false, problem: true, message: 'No selected image. Select one in Studio.' };
  }
  const missing = input.regions.find((region) => input.modes.find((option) => option.mode === region.mode)?.requiresInstruction && !region.instruction.trim());
  if (missing) {
    const optional = input.modes.find((option) => !option.requiresInstruction);
    return { ready: false, problem: true, message: `Region ${missing.number} needs an instruction${optional ? `, or set it to ${optional.label}` : ''}.` };
  }
  if (input.regions.length === 0 && !input.wholeImageInstruction.trim()) {
    return { ready: false, problem: false, message: 'Describe a change or mark a region.' };
  }
  const base = session.versions.find((version) => version.assetFileId === session.editBaseAssetFileId);
  return { ready: true, problem: false, message: `Edits Take ${base?.takeNumber ?? ''} · ⌘↵` };
}
