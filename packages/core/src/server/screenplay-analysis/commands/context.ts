import type { ScreenplayAnalysisContextReport } from '../../../client/screenplay-analysis/index.js';
import { withCurrentProjectSession } from '../../database/lifecycle/current-project.js';
import type { ScreenplayAnalysisProjectInput } from '../../project-data-service-contracts.js';
import { analysisResourceKeys } from '../story-arc-resource.js';
import { projectScreenplayAnalysisContext } from '../context.js';

export async function readScreenplayAnalysisContext(
  input: ScreenplayAnalysisProjectInput = {},
): Promise<ScreenplayAnalysisContextReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => ({
    valid: true,
    warnings: [],
    resourceKeys: analysisResourceKeys(),
    ...projectScreenplayAnalysisContext({
      session,
      project: { id: currentProject.projectId, projectName: currentProject.projectName },
    }),
  }));
}
