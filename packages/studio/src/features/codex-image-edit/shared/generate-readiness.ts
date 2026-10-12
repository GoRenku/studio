import type { ImageEditRegion, ImageEditSession } from '@gorenku/studio-codex/image-edit';

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
}): ImageEditGenerateReadiness {
  const { session } = input;
  if (session.action && session.action.status !== 'failed') {
    return { ready: false, problem: false, message: `Generating Take ${nextImageEditTakeNumber(session)}…` };
  }
  if (!session.editBaseAssetFileId) {
    return { ready: false, problem: true, message: 'No selected image. Select one in Studio.' };
  }
  const modes = session.route.regionModes ?? [];
  const missing = input.regions.find((region) => modes.find((option) => option.id === region.mode)?.instructionRequired && !region.instruction.trim());
  if (missing) {
    const optional = modes.find((option) => !option.instructionRequired);
    return { ready: false, problem: true, message: `Region ${missing.number} needs an instruction${optional ? `, or set it to ${optional.label}` : ''}.` };
  }
  if (input.regions.length === 0 && !input.wholeImageInstruction.trim()) {
    return { ready: false, problem: false, message: session.route.regionModes ? 'Describe a change or mark a region.' : 'Describe a change.' };
  }
  const base = session.versions.find((version) => version.assetFileId === session.editBaseAssetFileId);
  return { ready: true, problem: false, message: `Edits Take ${base?.takeNumber ?? ''} · ⌘↵` };
}
