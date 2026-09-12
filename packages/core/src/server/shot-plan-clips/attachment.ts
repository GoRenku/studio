import type { MediaTarget } from '../../client/media-attachments.js';
import type { AttachGenerationMediaInput } from '../generation/attachments.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { requireClip, requireClipRevision, requireTake } from './records.js';
import { validateTakeTitle } from './validation.js';

export function resolveClipAttachmentRevision(session: DatabaseSession, input: AttachGenerationMediaInput) {
  if (input.clipId === undefined) {
    if (input.takeTitle !== undefined || input.sourceTakeId !== undefined) {
      throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'Take metadata requires a clip.');
    }
    return undefined;
  }
  if (input.purpose !== 'shot-plan.video-generation' || input.target?.kind !== 'shotPlan') {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'Clip attachment requires a Shot Plan video target.');
  }
  const clip = requireClip(session, input.clipId);
  const revision = requireClipRevision(session, clip.previsRevisionId, input.target.id);
  if (input.previsRevisionId !== undefined && input.previsRevisionId !== revision.id) {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'The supplied revision does not own this clip.');
  }
  validateTakeTitle(input.takeTitle);
  if (input.sourceTakeId !== undefined) {
    requireTake(session, input.sourceTakeId);
  }
  return revision.id;
}

export function resolveClipAttachmentTarget(session: DatabaseSession, input: {
  purpose: AttachGenerationMediaInput['purpose']; target?: MediaTarget; clipId?: string;
}): MediaTarget {
  if (input.target !== undefined) {
    return input.target;
  }
  if (input.clipId !== undefined && input.purpose === 'shot-plan.video-generation') {
    const clip = requireClip(session, input.clipId);
    return { kind: 'shotPlan', id: requireClipRevision(session, clip.previsRevisionId).shotPlanId };
  }
  throw new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Supply a media target or a Shot Plan video clip.');
}
