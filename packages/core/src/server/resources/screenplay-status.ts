import type { ScreenplayStatusReport } from '../../client/screenplay.js';
import {
  hasScreenplayRecord,
  readScreenplayStatusCounts,
} from '../database/access/screenplay-status.js';
import {
  withCurrentProjectSession,
} from '../database/lifecycle/current-project.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export async function readScreenplayStatus(
  input: RenkuConfigPathOptions = {}
): Promise<ScreenplayStatusReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => ({
    valid: true,
    warnings: [],
    project: { name: currentProject.projectName, id: currentProject.projectId },
    exists: hasScreenplayRecord(session),
    counts: readScreenplayStatusCounts(session),
    resourceKeys: ['screenplay'],
  }));
}
