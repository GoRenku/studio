import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  createDiagnosticError,
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import type { CastMember } from '../../client/cast-members.js';
import type {
  CastDesignContextReport,
  CastMemberInput,
  CastOperationDocument,
  DepartmentCommandChange,
  DepartmentCommandReport,
  DepartmentGeneratedId,
} from '../../client/department-design.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import {
  listProjectLocaleRecords,
  type ProjectLocaleRecord,
} from '../database/access/project-locales.js';
import type { ProjectLanguage } from '../../client/project-languages.js';
import {
  readActiveCastDesignDocument,
  toCastDesignSummary,
} from '../database/access/department-design.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  allocateDepartmentId,
  applyPlacement,
  assertExistingObjectUsesId,
  assertNewObjectUsesKey,
  collectReferencedCastMemberIds,
  projectSummary,
  throwIfDepartmentIssues,
  moveByPlacement,
} from './department-command-support.js';
import { assertCastOperationDocument } from '../department-design-json/validator.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  listCastAssetRoleSelectionRecords,
  listCastMemberRecords,
  readCastMemberDeleteDependencySummary,
  type CastMemberDeleteDependencySummary,
  replaceCastMemberAuthoringRecords,
} from '../database/access/cast-members.js';
import { listLocationRecords } from '../database/access/locations.js';

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
    const screenplay = readScreenplayDocumentFromSession(session);
    const projectInfo = readProjectInformationResourceFromDatabase(session);
    const activeDesign = readActiveCastDesignDocument(session, input.castMemberId);
    const selectedAssets = listCastAssetRoleSelectionRecords(session, input.castMemberId);
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
          summary: projectInfo.summary,
        }),
        languages: listProjectLocaleRecords(session).map(toProjectLanguage),
      },
      resourceKeys: castResourceKeys(input.castMemberId),
      castMember,
      screenplay: screenplay
        ? {
            title: screenplay.screenplay.title,
            logline: screenplay.screenplay.logline,
            summary: screenplay.screenplay.summary,
            centralConflict: screenplay.screenplay.centralConflict,
            dramaticQuestion: screenplay.screenplay.dramaticQuestion,
          }
        : null,
      activeDesign: activeDesign?.document ?? null,
      activeDesignSummary: activeDesign
        ? toCastDesignSummary({
            id: activeDesign.id,
            document: activeDesign.document,
          })
        : null,
      scenes: screenplay ? castScenes(screenplay, input.castMemberId) : [],
      activeLookbook: null,
      selectedAssets: [],
      assetRoleCounts: roleCounts(selectedAssets),
      generationReadiness: {
        characterSheet: true,
        profile: selectedAssets.some((asset) => asset.role === 'character-sheet'),
        notes: [
          'Use media-producer for cast.character-sheet and cast.profile generation.',
          'Costume-variant media and voice media do not have first-class generation targets yet.',
        ],
      },
    };
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
    const screenplay = readScreenplayDocumentFromSession(session);
    const referencedCastMemberIds = screenplay
      ? collectReferencedCastMemberIds(screenplay)
      : new Set<string>();
    const generatedIds: DepartmentGeneratedId[] = [];
    const changes: DepartmentCommandChange[] = [];
    const draft = [...existing];
    const issues: DiagnosticIssue[] = [];

    input.document.operations.forEach((operation, operationIndex) => {
      const operationPath = ['operations', String(operationIndex)];
      if (operation.operation === 'castMember.add') {
        assertNewObjectUsesKey({
          id: operation.castMember.id,
          key: operation.castMember.key,
          path: [...operationPath, 'castMember'],
          label: 'cast member',
          issues,
        });
        if (issues.length > 0) {
          return;
        }
        const id = allocateDepartmentId({
          prefix: 'cast',
          key: operation.castMember.key as string,
          kind: 'cast',
          path: [...operationPath, 'castMember', 'key'],
          idGenerator: input.idGenerator,
          generatedIds,
        });
        const castMember = toCastMember({ ...operation.castMember, id });
        draft.splice(
          0,
          draft.length,
          ...applyPlacement(draft, castMember, operation.placement)
        );
        changes.push({ operation: operation.operation, castMemberId: id });
      }
      if (operation.operation === 'castMember.update') {
        assertExistingObjectUsesId({
          id: operation.castMember.id,
          key: operation.castMember.key,
          path: [...operationPath, 'castMember'],
          label: 'cast member',
          issues,
        });
        const id = operation.castMember.id;
        const index = id ? draft.findIndex((castMember) => castMember.id === id) : -1;
        if (id && index === -1) {
          issues.push(notFoundIssue('cast member', [...operationPath, 'castMember', 'id']));
          return;
        }
        if (id && index !== -1) {
          draft[index] = toCastMember(operation.castMember);
          changes.push({ operation: operation.operation, castMemberId: id });
        }
      }
      if (operation.operation === 'castMember.delete') {
        const index = draft.findIndex((castMember) => castMember.id === operation.castMemberId);
        if (index === -1) {
          issues.push(notFoundIssue('cast member', [...operationPath, 'castMemberId']));
          return;
        }
        const hasScreenplayReferences = referencedCastMemberIds.has(
          operation.castMemberId
        );
        if (hasScreenplayReferences) {
          issues.push(
            createDiagnosticError(
              'PROJECT_DATA216',
              'Cast member is still referenced by screenplay scenes or blocks.',
              { path: [...operationPath, 'castMemberId'] },
              'Revise screenplay scene references before deleting this cast member.'
            )
          );
        }
        const dependencies = readCastMemberDeleteDependencySummary(
          session,
          operation.castMemberId
        );
        const dependencyLabels = castMemberDeleteDependencyLabels(dependencies);
        if (dependencyLabels.length > 0) {
          issues.push(
            castMemberDeleteDependencyIssue({
              dependencyLabels,
              path: [...operationPath, 'castMemberId'],
            })
          );
        }
        if (hasScreenplayReferences || dependencyLabels.length > 0) {
          return;
        }
        draft.splice(index, 1);
        changes.push({ operation: operation.operation, castMemberId: operation.castMemberId });
      }
      if (operation.operation === 'castMember.move') {
        draft.splice(
          0,
          draft.length,
          ...moveByPlacement(draft, operation.castMemberId, operation.placement, 'Cast member')
        );
        changes.push({ operation: operation.operation, castMemberId: operation.castMemberId });
      }
    });

    validateCastDraft({
      cast: draft,
      locationHandles,
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
    'navigation:cast',
    ...(castMemberId
      ? [`surface:castMember:${castMemberId}`, `surface:castDesign:${castMemberId}`]
      : []),
  ];
}

function listCastMembersFromSession(session: DatabaseSession): CastMember[] {
  return listCastMemberRecords(session).map((row) => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      role: row.role ?? undefined,
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

function toCastMember(input: CastMemberInput): CastMember {
  if (!input.id) {
    throw new ProjectDataError('PROJECT_DATA206', 'Cast member requires id.', {
      suggestion: 'Use key for adds and id for updates.',
    });
  }
  return {
    id: input.id,
    handle: input.handle,
    name: input.name,
    role: input.role,
    age: input.age,
    want: input.want,
    need: input.need,
    arc: input.arc,
    voiceNotes: input.voiceNotes,
    description: input.description,
  };
}

function validateCastDraft(input: {
  cast: CastMember[];
  locationHandles: Map<string, string>;
  issues: DiagnosticIssue[];
  warnings: DiagnosticIssue[];
}): void {
  const handles = new Map<string, string[]>();
  input.locationHandles.forEach((_locationId, handle) => {
    handles.set(handle, ['locations', handle]);
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
          'Use a unique handle across cast and locations.'
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
  const keys = new Set(castResourceKeys());
  changes.forEach((change) => {
    const castMemberId = change.castMemberId;
    if (typeof castMemberId === 'string') {
      castResourceKeys(castMemberId).forEach((key) => keys.add(key));
    }
  });
  return [...keys];
}

function castScenes(
  screenplay: NonNullable<ReturnType<typeof readScreenplayDocumentFromSession>>,
  castMemberId: string
): CastDesignContextReport['scenes'] {
  const scenes: CastDesignContextReport['scenes'] = [];
  screenplay.acts.forEach((act) =>
    act.sequences.forEach((sequence) =>
      sequence.scenes.forEach((scene) => {
        const referenced = scene.blocks.some(
          (block) =>
            block.castMemberIds?.includes(castMemberId) ||
            (block.type === 'dialogue' && block.castMemberId === castMemberId)
        );
        if (referenced) {
          scenes.push({
            sceneId: scene.id as string,
            sequenceId: sequence.id as string,
            sequenceTitle: sequence.title,
            title: scene.title,
            setting: scene.setting,
            blocks: scene.blocks,
          });
        }
      })
    )
  );
  return scenes;
}

function roleCounts(
  records: Array<{ role: string; selection: string }>
): Array<{ role: string; selectedCount: number; takeCount: number }> {
  const counts = new Map<string, { role: string; selectedCount: number; takeCount: number }>();
  records.forEach((record) => {
    const count = counts.get(record.role) ?? {
      role: record.role,
      selectedCount: 0,
      takeCount: 0,
    };
    if (record.selection === 'select') {
      count.selectedCount += 1;
    } else {
      count.takeCount += 1;
    }
    counts.set(record.role, count);
  });
  return [...counts.values()];
}

function castMemberDeleteDependencyIssue(input: {
  dependencyLabels: string[];
  path: string[];
}): DiagnosticIssue {
  return createDiagnosticError(
    'PROJECT_DATA217',
    `Cast member has dependent ${joinDependencyLabels(input.dependencyLabels)}.`,
    { path: input.path },
    'Remove or reassign dependent Cast assets and Cast Designs before deleting this cast member.'
  );
}

function castMemberDeleteDependencyLabels(
  dependencies: CastMemberDeleteDependencySummary
): string[] {
  return [
    dependencies.assetCount > 0
      ? pluralizeDependency('Cast asset', dependencies.assetCount)
      : null,
    dependencies.designCount > 0
      ? pluralizeDependency('Cast Design', dependencies.designCount)
      : null,
    dependencies.activeDesignStateCount > 0 ? 'active Cast Design state' : null,
  ].filter(isString);
}

function joinDependencyLabels(labels: string[]): string {
  if (labels.length <= 1) {
    return labels[0] ?? 'records';
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function pluralizeDependency(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function isString(value: string | null): value is string {
  return value !== null;
}

function notFoundIssue(label: string, path: string[]): DiagnosticIssue {
  return createDiagnosticError(
    'PROJECT_DATA205',
    `${label} was not found.`,
    { path },
    'Check the id from the latest list command.'
  );
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
