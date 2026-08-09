import type {
  ScreenplayMutationReport,
  ScreenplayRevisionListReport,
  ScreenplayRevisionReadReport,
} from '../../../client/screenplay/index.js';
import { createRandomIdGenerator } from '../../entity-ids.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import {
  listScreenplayRevisionSummaries,
  readScreenplayRevision as readStoredScreenplayRevision,
} from '../persistence/revisions.js';
import { ScreenplayIdentityResolver, commitScreenplayMutation } from './screenplay.js';
import { restoreAgentSceneNumbers } from '../scene-numbering.js';

export async function listScreenplayRevisions(
  input: RenkuConfigPathOptions & { projectName: string },
): Promise<ScreenplayRevisionListReport> {
  const { session } = await openProjectSession(input);
  try {
    return { revisions: listScreenplayRevisionSummaries(session) };
  } finally {
    session.close();
  }
}

export async function readScreenplayRevision(
  input: RenkuConfigPathOptions & { projectName: string; revisionId: string },
): Promise<ScreenplayRevisionReadReport> {
  const { session } = await openProjectSession(input);
  try {
    return readStoredScreenplayRevision({ session, revisionId: input.revisionId });
  } finally {
    session.close();
  }
}

export async function restoreScreenplayRevision(
  input: RenkuConfigPathOptions & { projectName: string; revisionId: string },
): Promise<ScreenplayMutationReport> {
  const { session } = await openProjectSession(input);
  try {
    const stored = readStoredScreenplayRevision({
      session,
      revisionId: input.revisionId,
    });
    return commitScreenplayMutation({
      session,
      screenplay: stored.screenplay,
      resolver: new ScreenplayIdentityResolver(createRandomIdGenerator()),
      sourceCommand: 'screenplay.revision.restore',
      summary: `Restored ${input.revisionId}`,
      prepareTransaction: (txSession, screenplay) => {
        restoreAgentSceneNumbers({ session: txSession, screenplay });
      },
    });
  } finally {
    session.close();
  }
}
