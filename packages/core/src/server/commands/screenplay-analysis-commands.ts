import type {
  ScreenplayAnalysisContextReport,
  ScreenplayAnalysisListReport,
  ScreenplayAnalysisReadReport,
  ScreenplayAnalysisValidationReport,
  ScreenplayAnalysisWriteReport,
} from '../../client/screenplay-analysis.js';
import { DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA } from '../../client/screenplay-analysis.js';
import type { ScreenplayDocument } from '../../client/screenplay.js';
import {
  listScreenplayAnalysisRecords,
  readActiveScreenplayAnalysisId,
  readActiveScreenplayAnalysisRecord,
  readScreenplayAnalysisDocument,
  requireScreenplayAnalysisRecord,
  setActiveScreenplayAnalysisRecord,
  toScreenplayAnalysisSummary,
  writeScreenplayAnalysisRecord,
} from '../database/access/screenplay-analysis.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  ReadScreenplayAnalysisInput,
  ScreenplayAnalysisProjectInput,
  SetActiveScreenplayAnalysisInput,
  ValidateScreenplayAnalysisInput,
  WriteScreenplayAnalysisInput,
} from '../project-data-service-contracts.js';
import { assertScreenplayAnalysisDocument } from '../screenplay-analysis-json/validator.js';
import { studioStoryArcSurfaceResourceKey } from '../studio-coordination/resource-keys.js';

export const SCREENPLAY_ANALYSIS_RESOURCE_KEYS = [
  studioStoryArcSurfaceResourceKey(),
  'screenplay-analysis',
] as const;

export async function readScreenplayAnalysisContext(
  input: ScreenplayAnalysisProjectInput = {}
): Promise<ScreenplayAnalysisContextReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const activeAnalysis = readActiveScreenplayAnalysisRecord(session);
    const activeAnalysisId = activeAnalysis?.id ?? null;
    return {
      valid: true,
      warnings: [],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      resourceKeys: [...SCREENPLAY_ANALYSIS_RESOURCE_KEYS],
      screenplay: {
        title: screenplay.screenplay.title,
        logline: screenplay.screenplay.logline,
        summary: screenplay.screenplay.summary,
        dramaticQuestion: screenplay.screenplay.dramaticQuestion,
        premiseOverview: screenplay.screenplay.premiseOverview,
        centralConflict: screenplay.screenplay.centralConflict,
        themes: screenplay.screenplay.themes ?? [],
        tone: screenplay.screenplay.tone ?? [],
        genrePrimary: screenplay.screenplay.genrePrimary,
        genreSecondary: screenplay.screenplay.genreSecondary ?? [],
        acts: screenplay.acts.map((act) => ({
          id: requiredId(act.id, 'act'),
          title: act.title,
          purpose: act.purpose,
          sequences: act.sequences.map((sequence) => ({
            id: requiredId(sequence.id, 'sequence'),
            title: sequence.title,
            purpose: sequence.purpose,
            scenes: sequence.scenes.map((scene) => ({
              id: requiredId(scene.id, 'scene'),
              title: scene.title,
              setting: scene.setting,
              storyFunction: scene.storyFunction ?? [],
              blocks: scene.blocks,
            })),
          })),
        })),
      },
      cast: screenplay.cast.map((castMember) => ({
        id: requiredId(castMember.id, 'cast member'),
        handle: castMember.handle,
        name: castMember.name,
        isVoiceOver: castMember.isVoiceOver,
        role: castMember.role,
      })),
      locations: screenplay.locations.map((location) => ({
        id: requiredId(location.id, 'location'),
        handle: location.handle,
        name: location.name,
        timePeriod: location.timePeriod,
      })),
      defaultCriteria: [...DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA],
      activeAnalysis: activeAnalysis
        ? toScreenplayAnalysisSummary({
            row: activeAnalysis,
            screenplay,
            activeAnalysisId,
          })
        : null,
    };
  });
}

export async function listScreenplayAnalyses(
  input: ScreenplayAnalysisProjectInput = {}
): Promise<ScreenplayAnalysisListReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    return {
      valid: true,
      warnings: [],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      resourceKeys: [...SCREENPLAY_ANALYSIS_RESOURCE_KEYS],
      analyses: listScreenplayAnalysisRecords({ session, screenplay }),
      activeAnalysisId: readActiveScreenplayAnalysisId(session),
    };
  });
}

export async function readScreenplayAnalysis(
  input: ReadScreenplayAnalysisInput
): Promise<ScreenplayAnalysisReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const activeAnalysisId = readActiveScreenplayAnalysisId(session);
    const row = input.active
      ? readActiveScreenplayAnalysisRecord(session)
      : requireScreenplayAnalysisRecord(session, requiredAnalysisId(input.analysisId));
    if (!row) {
      return {
        valid: true,
        warnings: [],
        project: { name: currentProject.projectName, id: currentProject.projectId },
        resourceKeys: [...SCREENPLAY_ANALYSIS_RESOURCE_KEYS],
        analysis: null,
        summary: null,
        activeAnalysisId,
      };
    }
    return {
      valid: true,
      warnings: [],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      resourceKeys: analysisResourceKeys(row.id),
      analysis: readScreenplayAnalysisDocument({ row, screenplay }),
      summary: toScreenplayAnalysisSummary({ row, screenplay, activeAnalysisId }),
      activeAnalysisId,
    };
  });
}

export async function validateScreenplayAnalysis(
  input: ValidateScreenplayAnalysisInput
): Promise<ScreenplayAnalysisValidationReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertScreenplayAnalysisDocument({
      document: input.document,
      screenplay,
      filePath: input.filePath,
    });
    return {
      valid: true,
      warnings,
      project: { name: currentProject.projectName, id: currentProject.projectId },
      resourceKeys: [...SCREENPLAY_ANALYSIS_RESOURCE_KEYS],
      analysis: input.document,
    };
  });
}

export async function writeScreenplayAnalysis(
  input: WriteScreenplayAnalysisInput
): Promise<ScreenplayAnalysisWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertScreenplayAnalysisDocument({
      document: input.document,
      screenplay,
      filePath: input.filePath,
    });
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const analysisId = ids('screenplay_analysis');
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      writeScreenplayAnalysisRecord({
        session: txSession,
        id: analysisId,
        document: input.document,
        screenplay,
        now,
        filePath: input.filePath,
      });
      setActiveScreenplayAnalysisRecord(txSession, { analysisId, now });
    });
    const row = requireScreenplayAnalysisRecord(session, analysisId);
    return {
      valid: true,
      warnings,
      project: { name: currentProject.projectName, id: currentProject.projectId },
      resourceKeys: analysisResourceKeys(analysisId),
      analysis: toScreenplayAnalysisSummary({
        row,
        screenplay,
        activeAnalysisId: analysisId,
      }),
      activeAnalysisId: analysisId,
      changes: [
        { type: 'screenplayAnalysis.created', analysisId },
        { type: 'screenplayAnalysis.activeSet', analysisId },
      ],
    };
  });
}

export async function setActiveScreenplayAnalysis(
  input: SetActiveScreenplayAnalysisInput
): Promise<ScreenplayAnalysisWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const now = new Date().toISOString();
    setActiveScreenplayAnalysisRecord(session, {
      analysisId: input.analysisId,
      now,
    });
    const row = requireScreenplayAnalysisRecord(session, input.analysisId);
    return {
      valid: true,
      warnings: [],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      resourceKeys: analysisResourceKeys(input.analysisId),
      analysis: toScreenplayAnalysisSummary({
        row,
        screenplay,
        activeAnalysisId: input.analysisId,
      }),
      activeAnalysisId: input.analysisId,
      changes: [{ type: 'screenplayAnalysis.activeSet', analysisId: input.analysisId }],
    };
  });
}

export function analysisResourceKeys(analysisId: string): string[] {
  return [
    ...SCREENPLAY_ANALYSIS_RESOURCE_KEYS,
    `screenplay-analysis:${analysisId}`,
  ];
}

function requireScreenplayDocument(
  session: Parameters<typeof readScreenplayDocumentFromSession>[0]
): ScreenplayDocument {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
      suggestion: 'Use `renku screenplay create` first.',
    });
  }
  return screenplay;
}

function requiredAnalysisId(analysisId: string | undefined): string {
  if (!analysisId) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      'Screenplay Analysis id is required.',
      { suggestion: 'Use --analysis <analysis-id> or --active.' }
    );
  }
  return analysisId;
}

function requiredId(id: string | undefined, label: string): string {
  if (!id) {
    throw new ProjectDataError(
      'PROJECT_DATA219',
      `A ${label} record was missing an allocated id.`
    );
  }
  return id;
}
