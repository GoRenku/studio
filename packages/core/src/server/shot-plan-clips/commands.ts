import { and, eq, max } from 'drizzle-orm';
import type { ReadShotPlanClipsInput, RegisterShotPlanClipTakeInput, SelectShotPlanClipTakeInput, UpdateShotPlanClipTakeInput, ResolveShotPlanClipTakeInput } from '../../client/shot-plan-clips.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { withProject } from '../project-operation.js';
import { createRandomIdGenerator } from '../entity-ids.js';
import { shotPlanClips, shotPlanClipTakes } from '../schema/shot-plan-clips.js';
import { ProjectDataError } from '../project-data-error.js';
import { requireClip, requireClipRevision, requireTake } from './records.js';
import { projectShotPlanClips } from './projection.js';
import { validateTakeRegistration, validateTakeTitle, requireActiveTakeFile } from './validation.js';

export async function readShotPlanClips(input: ReadShotPlanClipsInput) {
  return withProject(input, ({ session }) => projectShotPlanClips(session, input.shotPlanId, input.previsRevisionId));
}

export async function createShotPlanClip(input: ReadShotPlanClipsInput) {
  return withProject(input, ({ session }) => {
    session.db.transaction(() => {
      requireClipRevision(session, input.previsRevisionId, input.shotPlanId);
      const number = (session.db.select({ value: max(shotPlanClips.number) }).from(shotPlanClips).where(eq(shotPlanClips.previsRevisionId, input.previsRevisionId)).get()?.value ?? 0) + 1;
      session.db.insert(shotPlanClips).values({ id: createRandomIdGenerator().next('clip'), previsRevisionId: input.previsRevisionId, number, createdAt: new Date().toISOString() }).run();
    });
    return projectShotPlanClips(session, input.shotPlanId, input.previsRevisionId);
  });
}

export function registerClipTakeInSession(session: DatabaseSession, input: RegisterShotPlanClipTakeInput) {
  const { clip } = validateTakeRegistration(session, input);
  const existing = session.db.select().from(shotPlanClipTakes).where(eq(shotPlanClipTakes.assetFileId, input.assetFileId)).get();
  if (existing) {
    if (existing.clipId !== input.clipId || existing.title !== (input.title ?? null) || existing.sourceTakeId !== (input.sourceTakeId ?? null)) {
      throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_FILE_ALREADY_ASSIGNED', 'This file already has a different clip take assignment.');
    }
    return existing;
  } else {
    const number = (session.db.select({ value: max(shotPlanClipTakes.number) }).from(shotPlanClipTakes).where(eq(shotPlanClipTakes.clipId, clip.id)).get()?.value ?? 0) + 1;
    return session.db.insert(shotPlanClipTakes).values({ id: createRandomIdGenerator().next('clip_take'), clipId: clip.id, number,
      assetId: input.assetId, assetFileId: input.assetFileId, title: input.title ?? null, sourceTakeId: input.sourceTakeId ?? null, createdAt: new Date().toISOString() }).returning().get();
  }
}

export async function registerShotPlanClipTake(input: RegisterShotPlanClipTakeInput) {
  return withProject(input, ({ session }) => session.db.transaction(() => {
    registerClipTakeInSession(session, input);
    const clip = requireClip(session, input.clipId);
    const revision = requireClipRevision(session, clip.previsRevisionId);
    return projectShotPlanClips(session, revision.shotPlanId, revision.id);
  }));
}

export async function selectShotPlanClipTake(input: SelectShotPlanClipTakeInput) {
  return withProject(input, ({ session }) => session.db.transaction(() => {
    const clip = requireClip(session, input.clipId);
    const revision = requireClipRevision(session, clip.previsRevisionId);
    if (input.takeId !== null) {
      const take = requireTake(session, input.takeId);
      if (take.clipId !== clip.id) {
        throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_SELECTION_INVALID', 'Choose a take of this clip.');
      }
      requireActiveTakeFile(session, take.assetId, take.assetFileId);
    }
    session.db.update(shotPlanClips).set({ selectedTakeId: input.takeId }).where(eq(shotPlanClips.id, clip.id)).run();
    return projectShotPlanClips(session, revision.shotPlanId, revision.id);
  }));
}

export async function updateShotPlanClipTake(input: UpdateShotPlanClipTakeInput) {
  if (input.title === undefined) {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'Supply a title or null.');
  }
  validateTakeTitle(input.title);
  return withProject(input, ({ session }) => session.db.transaction(() => {
    const take = requireTake(session, input.takeId);
    const clip = requireClip(session, take.clipId);
    const revision = requireClipRevision(session, clip.previsRevisionId);
    session.db.update(shotPlanClipTakes).set({ title: input.title }).where(eq(shotPlanClipTakes.id, take.id)).run();
    return projectShotPlanClips(session, revision.shotPlanId, revision.id);
  }));
}

export async function resolveShotPlanClipTake(input: ResolveShotPlanClipTakeInput) {
  if (![input.clipNumber, input.takeNumber].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'Clip and take numbers must be positive integers.');
  }
  return withProject(input, ({ session }) => {
    requireClipRevision(session, input.previsRevisionId, input.shotPlanId);
    const clip = session.db.select().from(shotPlanClips).where(and(eq(shotPlanClips.previsRevisionId, input.previsRevisionId), eq(shotPlanClips.number, input.clipNumber))).get();
    const take = clip && session.db.select().from(shotPlanClipTakes).where(and(eq(shotPlanClipTakes.clipId, clip.id), eq(shotPlanClipTakes.number, input.takeNumber))).get();
    if (!take) {
      throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_NOT_FOUND', 'No take has that clip and take number in this revision.');
    }
    return take;
  });
}
