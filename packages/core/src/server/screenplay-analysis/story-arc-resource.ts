import type { StoryArcResource } from '../../client/resources.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { studioStoryArcSurfaceResourceKey } from '../studio-coordination/resource-keys.js';
import { readActiveScreenplayAnalysisRecord, readStoredScreenplayAnalysis } from './persistence.js';
import { SCREENPLAY_ANALYSIS_NEEDS_REFRESH_HELP, screenplayAnalysisFreshness } from './freshness.js';

export async function readStoryArcResource(input: ReadProjectInput): Promise<StoryArcResource> {
  const { session } = await openProjectSession(input);
  try {
    const screenplay = readCanonicalScreenplay(session);
    const project = readProjectInformationResourceFromDatabase(session);
    const active = readActiveScreenplayAnalysisRecord(session);
    const freshness = active ? screenplayAnalysisFreshness(session, active) : 'current';
    return {
      project: {
        title: project.title,
        ...(project.logline ? { logline: project.logline } : {}),
        ...(project.dramaticQuestion ? { dramaticQuestion: project.dramaticQuestion } : {}),
        ...(project.premise ? { premise: project.premise } : {}),
        ...(project.centralConflict ? { centralConflict: project.centralConflict } : {}),
        ...(project.synopsis ? { synopsis: project.synopsis } : {}),
      },
      scenes: screenplay.scenes.map((scene) => ({
        id: scene.id,
        heading: scene.heading,
        productionNumber: scene.productionNumber,
        ...(scene.title ? { title: scene.title } : {}),
      })),
      activeAnalysis: active ? readStoredScreenplayAnalysis({ row: active }) : null,
      activeAnalysisFreshness: freshness,
      needsRefresh: freshness === 'needsRefresh',
      freshnessHelp: freshness === 'needsRefresh' ? SCREENPLAY_ANALYSIS_NEEDS_REFRESH_HELP : null,
    };
  } finally {
    session.close();
  }
}

export function analysisResourceKeys(analysisId?: string): string[] {
  return [
    studioStoryArcSurfaceResourceKey(),
    'screenplay-analysis',
    ...(analysisId ? [`screenplay-analysis:${analysisId}`] : []),
  ];
}
