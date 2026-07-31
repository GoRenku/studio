import { eq } from 'drizzle-orm';
import type { GenerationTarget } from '../../client/generation.js';
import type { GenerationPreviewSubject } from '../../client/generation-preview-resource.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { readLocationRecord } from '../database/access/locations.js';
import { readProjectRecord } from '../database/access/project.js';
import { readPropRecord } from '../database/access/props.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { scenes } from '../schema/index.js';

export function readGenerationPreviewSubject(
  session: DatabaseSession,
  target: GenerationTarget
): GenerationPreviewSubject {
  const project = readProjectRecord(session);
  const result: GenerationPreviewSubject = {
    projectLabel: project?.title || project?.name || 'Project',
  };
  if (target.kind === 'castMember') {
    const castMember = readCastMemberRecord(session, target.id);
    return {
      ...result,
      ...(castMember?.name ? { castMemberLabel: castMember.name } : {}),
    };
  }
  if (target.kind === 'location') {
    const location = readLocationRecord(session, target.id);
    return {
      ...result,
      ...(location?.name ? { locationLabel: location.name } : {}),
    };
  }
  if (target.kind === 'prop') {
    const prop = readPropRecord(session, target.id);
    return {
      ...result,
      ...(prop?.name ? { propLabel: prop.name } : {}),
    };
  }
  if (target.kind === 'scene') {
    const scene = session.db.select().from(scenes)
      .where(eq(scenes.id, target.id)).get();
    return {
      ...result,
      ...(scene?.title ? { sceneLabel: scene.title } : {}),
    };
  }
  return result;
}
