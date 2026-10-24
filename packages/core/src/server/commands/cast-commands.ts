import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  createDiagnosticError,
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import type { CastMember } from '../../client/cast-members.js';
import type {
  CastDesignContextReport,
  CastOperationDocument,
  DepartmentCommandChange,
  DepartmentCommandReport,
  DepartmentGeneratedId,
} from '../../client/department-design.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import {
  listProjectLocaleRecords,
  type ProjectLocaleRecord,
} from '../database/access/project-locales.js';
import type { ProjectLanguage } from '../../client/project-languages.js';
import {
  readActiveCastDesignDocument,
  toCastDesignSummary,
} from '../database/access/cast-designs.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  collectReferencedCastMemberIds,
  projectSummary,
  throwIfDepartmentIssues,
} from './department-command-support.js';
import { assertCastOperationDocument } from '../department-design-json/validator.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { CastOperationContext } from './cast-operations/context.js';
import { applyCastOperation } from './cast-operations/handlers.js';
import {
  listCastAssetFileRoleRecords,
  listCastMemberRecords,
  replaceCastMemberAuthoringRecords,
  updateCastMemberVoiceOverRecord,
} from '../database/access/cast-members.js';
import { listLocationRecords } from '../database/access/locations.js';
import { listPropRecords } from '../database/access/props.js';
import { listAssetFilesInSession } from '../asset-files/projection.js';
import {
  studioCastMemberSurfaceResourceKey,
  studioCastNavigationResourceKey,
  studioProjectShellResourceKey,
} from '../studio-coordination/resource-keys.js';
import { readDepartmentProductionLookbookContext } from '../media-generation-context/visual-language-context.js';

export async function listCastMembers(
  input: RenkuConfigPathOptions = {}
): Promise<CastMember[]> {
  return await withCurrentProjectSession(input, ({ session }) =>
    listCastMembersFromSession(session)
  );
}

export async function readCastMember(
  input: RenkuConfigPathOptions & { castMemberId: string }
): Promise<CastMember> {
  return await withCurrentProjectSession(input, ({ session }) =>
    requireCastMember(session, input.castMemberId)
  );
}

export async function readCastContext(
  input: RenkuConfigPathOptions & { castMemberId: string }
): Promise<CastDesignContextReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const castMember = requireCastMember(session, input.castMemberId);
    const screenplay = readCanonicalScreenplay(session);
    const projectInfo = readProjectInformationResourceFromDatabase(session);
    const activeDesign = readActiveCastDesignDocument(session, input.castMemberId);
    const assetFiles = listCastAssetFileRoleRecords(session, input.castMemberId);
    const ownedAssetFiles = listAssetFilesInSession(session, {
      owner: { kind: 'castMember', id: input.castMemberId },
    });
    return {
      valid: true,
      warnings: [],
      project: {
        ...projectSummary({
          projectName: currentProject.projectName,
          projectId: currentProject.projectId,
          projectFolder: currentProject.projectFolder,
          title: projectInfo.title,
          aspectRatio: projectInfo.aspectRatio,
          logline: projectInfo.logline,
          synopsis: projectInfo.synopsis,
        }),
        languages: listProjectLocaleRecords(session).map(toProjectLanguage),
      },
      resourceKeys: castResourceKeys(input.castMemberId),
      castMember,
      screenplay: {
        title: projectInfo.title,
        ...(projectInfo.logline ? { logline: projectInfo.logline } : {}),
        ...(projectInfo.synopsis ? { synopsis: projectInfo.synopsis } : {}),
        ...(projectInfo.centralConflict ? { centralConflict: projectInfo.centralConflict } : {}),
        ...(projectInfo.dramaticQuestion ? { dramaticQuestion: projectInfo.dramaticQuestion } : {}),
      },
      activeDesign: activeDesign?.document ?? null,
      activeDesignSummary: activeDesign
        ? toCastDesignSummary({
            id: activeDesign.id,
            document: activeDesign.document,
          })
        : null,
      scenes: castScenes(screenplay, input.castMemberId),
      activeLookbook: readDepartmentProductionLookbookContext({
        session,
        projectFolder: currentProject.projectFolder,
      }),
      assetFiles: ownedAssetFiles,
      assetFileTypeCounts: typeCounts(assetFiles),
      generationReadiness: castGenerationReadiness(castMember, assetFiles),
    };
  });
}

export async function updateCastMemberVoiceOverStatus(
  input: RenkuConfigPathOptions & {
    projectName: string;
    castMemberId: string;
    isVoiceOver: boolean;
  }
): Promise<CastMember> {
  return await withCurrentProjectSession(input, ({ session }) => {
    const updated = updateCastMemberVoiceOverRecord(session, {
      castMemberId: input.castMemberId,
      isVoiceOver: input.isVoiceOver,
    });
    if (!updated) {
      throw new ProjectDataError('PROJECT_DATA205', 'Cast member was not found.', {
        suggestion: 'Check the id from the current Cast list.',
      });
    }
    return requireCastMember(session, input.castMemberId);
  });
}

export async function validateCastOperations(
  input: RenkuConfigPathOptions & {
    document: CastOperationDocument;
    filePath?: string;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<DepartmentCommandReport> {
  return await applyCastOperations({ ...input, dryRun: true });
}

export async function applyCastOperations(
  input: RenkuConfigPathOptions & {
    document: CastOperationDocument;
    filePath?: string;
    dryRun?: boolean;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<DepartmentCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertCastOperationDocument({
      document: input.document,
      filePath: input.filePath,
    });
    const existing = listCastMembersFromSession(session);
    const locationHandles = new Map(
      listLocationRecords(session).map((location) => [location.handle, location.id])
    );
    const propHandles = new Map(
      listPropRecords(session).map((prop) => [prop.handle, prop.id])
    );
    const screenplay = readCanonicalScreenplay(session);
    const referencedCastMemberIds = collectReferencedCastMemberIds(screenplay);
    const generatedIds: DepartmentGeneratedId[] = [];
    const changes: DepartmentCommandChange[] = [];
    const draft = [...existing];
    const issues: DiagnosticIssue[] = [];

    const context: CastOperationContext = {
      session,
      ...(input.idGenerator ? { idGenerator: input.idGenerator } : {}),
      draft,
      referencedCastMemberIds,
      issues,
      changes,
      generatedIds,
    };
    input.document.operations.forEach((operation, operationIndex) => {
      applyCastOperation(context, operation, ['operations', String(operationIndex)]);
    });

    validateCastDraft({
      cast: draft,
      locationHandles,
      propHandles,
      issues,
      warnings,
    });
    throwIfDepartmentIssues(issues);

    if (!input.dryRun) {
      session.db.transaction((tx) => {
        const txSession = { ...session, db: tx };
        replaceCastMemberAuthoringRecords(txSession, draft);
      });
    }

    return {
      valid: true,
      warnings,
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      changes,
      generatedIds,
      resourceKeys: castResourceKeysForChanges(changes),
    };
  });
}

export function castResourceKeys(castMemberId?: string): string[] {
  return [
    studioCastNavigationResourceKey(),
    ...(castMemberId
      ? [
          studioCastMemberSurfaceResourceKey(castMemberId),
        ]
      : []),
  ];
}

function listCastMembersFromSession(session: DatabaseSession): CastMember[] {
  return listCastMemberRecords(session).map((row) => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      role: row.role ?? undefined,
      isVoiceOver: row.isVoiceOver,
      age: row.age ?? undefined,
      want: row.want ?? undefined,
      need: row.need ?? undefined,
      arc: row.arc ?? undefined,
      voiceNotes: row.voiceNotes ?? undefined,
      description: row.description ?? undefined,
    }));
}

function requireCastMember(
  session: DatabaseSession,
  castMemberId: string
): CastMember {
  const castMember = listCastMembersFromSession(session).find(
    (candidate) => candidate.id === castMemberId
  );
  if (!castMember) {
    throw new ProjectDataError('PROJECT_DATA205', 'Cast member was not found.', {
      suggestion: 'Check the id from `renku cast list --json`.',
    });
  }
  return castMember;
}

function castGenerationReadiness(
  castMember: CastMember,
  assetFiles: Array<{ type: string }>
): CastDesignContextReport['generationReadiness'] {
  if (castMember.isVoiceOver) {
    return {
      characterSheet: false,
      profile: true,
      notes: [
        'Voice-over Cast Members do not require visual character sheets.',
        'Use cast.profile for a symbolic navigation image only; it must not be treated as a physical character reference.',
        'Use Cast Voice records for durable voice identity and samples.',
      ],
    };
  }
  return {
    characterSheet: true,
    profile: assetFiles.some((assetFile) => assetFile.type === 'character_sheet'),
    notes: [
      'Use media-producer for cast.character-sheet and cast.profile generation.',
      'Costume-variant media and voice media do not have first-class generation targets yet.',
    ],
  };
}

function validateCastDraft(input: {
  cast: CastMember[];
  locationHandles: Map<string, string>;
  propHandles: Map<string, string>;
  issues: DiagnosticIssue[];
  warnings: DiagnosticIssue[];
}): void {
  const handles = new Map<string, string[]>();
  input.locationHandles.forEach((_locationId, handle) => {
    handles.set(handle, ['locations', handle]);
  });
  input.propHandles.forEach((_propId, handle) => {
    handles.set(handle, ['props', handle]);
  });
  const names = new Map<string, string[]>();
  input.cast.forEach((castMember, index) => {
    const path = ['cast', String(index)];
    const firstHandlePath = handles.get(castMember.handle);
    if (firstHandlePath) {
      input.issues.push(
        createDiagnosticError(
          'PROJECT_DATA209',
          `Duplicate handle: ${castMember.handle}.`,
          { path: [...path, 'handle'], context: `First seen at ${firstHandlePath.join('.')}` },
          'Use a unique handle across Cast Members, Locations, and Props.'
        )
      );
    } else {
      handles.set(castMember.handle, [...path, 'handle']);
    }
    const normalizedName = castMember.name.trim().toLocaleLowerCase();
    const firstNamePath = names.get(normalizedName);
    if (firstNamePath) {
      input.warnings.push(
        createDiagnosticWarning(
          'PROJECT_DATA215',
          `Likely duplicate cast member name: ${castMember.name}.`,
          { path: [...path, 'name'], context: `First seen at ${firstNamePath.join('.')}` },
          'Update the existing cast member when this is the same character.'
        )
      );
    } else {
      names.set(normalizedName, [...path, 'name']);
    }
  });
}

function castResourceKeysForChanges(changes: DepartmentCommandChange[]): string[] {
  const keys = new Set([
    studioProjectShellResourceKey(),
    ...castResourceKeys(),
  ]);
  changes.forEach((change) => {
    const castMemberId = change.castMemberId;
    if (typeof castMemberId === 'string') {
      castResourceKeys(castMemberId).forEach((key) => keys.add(key));
    }
  });
  return [...keys];
}

function castScenes(
  screenplay: ReturnType<typeof readCanonicalScreenplay>,
  castMemberId: string
): CastDesignContextReport['scenes'] {
  const scenes: CastDesignContextReport['scenes'] = [];
  for (const scene of screenplay.scenes) {
    const referenced = screenplay.references.some((reference) =>
      reference.subject.type === 'castMember'
      && reference.subject.id === castMemberId
      && 'sceneId' in reference.target
      && reference.target.sceneId === scene.id,
    );
    if (referenced) {
      scenes.push({
        sceneId: scene.id,
        ...(scene.productionNumber !== undefined ? { productionNumber: scene.productionNumber } : {}),
        heading: scene.heading,
        ...(scene.title ? { title: scene.title } : {}),
        blocks: scene.blocks,
      });
    }
  }
  return scenes;
}

function typeCounts(
  records: Array<{ type: string }>
): Array<{ type: string; count: number }> {
  const counts = new Map<string, { type: string; count: number }>();
  records.forEach((record) => {
    const count = counts.get(record.type) ?? {
      type: record.type,
      count: 0,
    };
    count.count += 1;
    counts.set(record.type, count);
  });
  return [...counts.values()];
}

function toProjectLanguage(row: ProjectLocaleRecord): ProjectLanguage {
  return {
    id: row.id,
    localeTag: row.localeTag,
    displayName: row.displayName ?? undefined,
    isBase: row.isBase,
    supportsAudio: row.supportsAudio,
    supportsSubtitles: row.supportsSubtitles,
  };
}
