import type {
  Act,
  CastMember,
  Location,
  Scene,
  ScreenplayDocument,
  ScreenplayReadReport,
  Sequence,
} from '../../client/screenplay.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  listScreenplayActsFromSession,
  listScreenplayCastMembersFromSession,
  listScreenplayLocationsFromSession,
  listScreenplayScenesForSequenceFromSession,
  listScreenplaySequencesForActFromSession,
  readScreenplayActFromSession,
  readScreenplayCastMemberFromSession,
  readScreenplayDocumentFromSession,
  readScreenplayLocationFromSession,
  readScreenplaySceneFromSession,
  readScreenplaySequenceFromSession,
} from '../database/access/screenplay-resource.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export async function readScreenplay(
  input: RenkuConfigPathOptions = {}
): Promise<ScreenplayReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const document = requireScreenplayDocument(readScreenplayDocumentFromSession(session));
    return {
      valid: true,
      warnings: [],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      screenplay: document,
      resourceKeys: ['screenplay'],
    };
  });
}

function requireScreenplayDocument(document: ScreenplayDocument | null): ScreenplayDocument {
  if (!document) {
    throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
      suggestion: 'Use `renku screenplay create` first.',
    });
  }
  return document;
}

export async function listScreenplayCastMembers(
  input: RenkuConfigPathOptions = {}
): Promise<CastMember[]> {
  return await withCurrentProjectSession(input, ({ session }) =>
    listScreenplayCastMembersFromSession(session)
  );
}

export async function readScreenplayCastMember(
  input: RenkuConfigPathOptions & { castMemberId: string }
): Promise<CastMember> {
  return await withCurrentProjectSession(input, ({ session }) =>
    readScreenplayCastMemberFromSession(session, input.castMemberId)
  );
}

export async function listScreenplayLocations(
  input: RenkuConfigPathOptions = {}
): Promise<Location[]> {
  return await withCurrentProjectSession(input, ({ session }) =>
    listScreenplayLocationsFromSession(session)
  );
}

export async function readScreenplayLocation(
  input: RenkuConfigPathOptions & { locationId: string }
): Promise<Location> {
  return await withCurrentProjectSession(input, ({ session }) =>
    readScreenplayLocationFromSession(session, input.locationId)
  );
}

export async function listScreenplayActs(
  input: RenkuConfigPathOptions = {}
): Promise<Act[]> {
  return await withCurrentProjectSession(input, ({ session }) =>
    listScreenplayActsFromSession(session)
  );
}

export async function readScreenplayAct(
  input: RenkuConfigPathOptions & { actId: string }
): Promise<Act> {
  return await withCurrentProjectSession(input, ({ session }) =>
    readScreenplayActFromSession(session, input.actId)
  );
}

export async function listScreenplaySequencesForAct(
  input: RenkuConfigPathOptions & { actId: string }
): Promise<Sequence[]> {
  return await withCurrentProjectSession(input, ({ session }) =>
    listScreenplaySequencesForActFromSession(session, input.actId)
  );
}

export async function readScreenplaySequence(
  input: RenkuConfigPathOptions & { sequenceId: string }
): Promise<Sequence> {
  return await withCurrentProjectSession(input, ({ session }) =>
    readScreenplaySequenceFromSession(session, input.sequenceId)
  );
}

export async function listScreenplayScenesForSequence(
  input: RenkuConfigPathOptions & { sequenceId: string }
): Promise<Scene[]> {
  return await withCurrentProjectSession(input, ({ session }) =>
    listScreenplayScenesForSequenceFromSession(session, input.sequenceId)
  );
}

export async function readScreenplayScene(
  input: RenkuConfigPathOptions & { sceneId: string }
): Promise<Scene> {
  return await withCurrentProjectSession(input, ({ session }) =>
    readScreenplaySceneFromSession(session, input.sceneId)
  );
}
