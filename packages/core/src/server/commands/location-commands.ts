import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  createDiagnosticError,
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import type { Location } from '../../client/locations.js';
import type {
  DepartmentCommandChange,
  DepartmentCommandReport,
  DepartmentGeneratedId,
  LocationInput,
  LocationOperationDocument,
  ProductionDesignLocationContextReport,
} from '../../client/department-design.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import {
  readActiveLocationDesignDocument,
  toLocationDesignSummary,
} from '../database/access/department-design.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  allocateDepartmentId,
  applyPlacement,
  assertExistingObjectUsesId,
  assertNewObjectUsesKey,
  collectReferencedLocationIds,
  moveByPlacement,
  projectSummary,
  throwIfDepartmentIssues,
} from './department-command-support.js';
import { assertLocationOperationDocument } from '../department-design-json/validator.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import {
  listLocationAssetRoleSelectionRecords,
  listLocationRecords,
  readLocationDeleteDependencySummary,
  type LocationDeleteDependencySummary,
  replaceLocationAuthoringRecords,
} from '../database/access/locations.js';
import {
  studioLocationDesignResourceKey,
  studioLocationNavigationResourceKey,
  studioLocationSurfaceResourceKey,
} from '../studio-coordination/resource-keys.js';

export async function listLocations(
  input: RenkuConfigPathOptions = {}
): Promise<Location[]> {
  return await withCurrentProjectSession(input, ({ session }) =>
    listLocationsFromSession(session)
  );
}

export async function readLocation(
  input: RenkuConfigPathOptions & { locationId: string }
): Promise<Location> {
  return await withCurrentProjectSession(input, ({ session }) =>
    requireLocation(session, input.locationId)
  );
}

export async function readLocationContext(
  input: RenkuConfigPathOptions & { locationId: string }
): Promise<ProductionDesignLocationContextReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const location = requireLocation(session, input.locationId);
    const screenplay = readScreenplayDocumentFromSession(session);
    const projectInfo = readProjectInformationResourceFromDatabase(session);
    const activeDesign = readActiveLocationDesignDocument(session, input.locationId);
    const selectedAssets = listLocationAssetRoleSelectionRecords(session, input.locationId);
    return {
      valid: true,
      warnings: [],
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
        title: projectInfo.title,
        aspectRatio: projectInfo.aspectRatio,
        logline: projectInfo.logline,
        summary: projectInfo.summary,
      }),
      resourceKeys: locationResourceKeys(input.locationId),
      location,
      activeDesign: activeDesign?.document ?? null,
      activeDesignSummary: activeDesign
        ? toLocationDesignSummary({
            id: activeDesign.id,
            document: activeDesign.document,
          })
        : null,
      scenes: screenplay ? locationScenes(screenplay, input.locationId) : [],
      activeLookbook: null,
      selectedAssets: [],
      assetRoleCounts: roleCounts(selectedAssets),
      generationReadiness: {
        environmentSheet: true,
        notes: ['Use media-producer for location.environment-sheet generation.'],
      },
    };
  });
}

export async function validateLocationOperations(
  input: RenkuConfigPathOptions & {
    document: LocationOperationDocument;
    filePath?: string;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<DepartmentCommandReport> {
  return await applyLocationOperations({ ...input, dryRun: true });
}

export async function applyLocationOperations(
  input: RenkuConfigPathOptions & {
    document: LocationOperationDocument;
    filePath?: string;
    dryRun?: boolean;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<DepartmentCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertLocationOperationDocument({
      document: input.document,
      filePath: input.filePath,
    });
    const existing = listLocationsFromSession(session);
    const castHandles = new Map(
      listCastMemberRecords(session).map((castMember) => [castMember.handle, castMember.id])
    );
    const screenplay = readScreenplayDocumentFromSession(session);
    const referencedLocationIds = screenplay
      ? collectReferencedLocationIds(screenplay)
      : new Set<string>();
    const generatedIds: DepartmentGeneratedId[] = [];
    const changes: DepartmentCommandChange[] = [];
    const draft = [...existing];
    const issues: DiagnosticIssue[] = [];

    input.document.operations.forEach((operation, operationIndex) => {
      const operationPath = ['operations', String(operationIndex)];
      if (operation.operation === 'location.add') {
        assertNewObjectUsesKey({
          id: operation.location.id,
          key: operation.location.key,
          path: [...operationPath, 'location'],
          label: 'location',
          issues,
        });
        if (issues.length > 0) {
          return;
        }
        const id = allocateDepartmentId({
          prefix: 'location',
          key: operation.location.key as string,
          kind: 'location',
          path: [...operationPath, 'location', 'key'],
          idGenerator: input.idGenerator,
          generatedIds,
        });
        const location = toLocation({ ...operation.location, id });
        draft.splice(0, draft.length, ...applyPlacement(draft, location, operation.placement));
        changes.push({ operation: operation.operation, locationId: id });
      }
      if (operation.operation === 'location.update') {
        assertExistingObjectUsesId({
          id: operation.location.id,
          key: operation.location.key,
          path: [...operationPath, 'location'],
          label: 'location',
          issues,
        });
        const id = operation.location.id;
        const index = id ? draft.findIndex((location) => location.id === id) : -1;
        if (id && index === -1) {
          issues.push(notFoundIssue('location', [...operationPath, 'location', 'id']));
          return;
        }
        if (id && index !== -1) {
          draft[index] = toLocation(operation.location);
          changes.push({ operation: operation.operation, locationId: id });
        }
      }
      if (operation.operation === 'location.delete') {
        const index = draft.findIndex((location) => location.id === operation.locationId);
        if (index === -1) {
          issues.push(notFoundIssue('location', [...operationPath, 'locationId']));
          return;
        }
        const hasScreenplayReferences = referencedLocationIds.has(operation.locationId);
        if (hasScreenplayReferences) {
          issues.push(
            createDiagnosticError(
              'PROJECT_DATA216',
              'Location is still referenced by screenplay scenes or blocks.',
              { path: [...operationPath, 'locationId'] },
              'Revise screenplay scene references before deleting this location.'
            )
          );
        }
        const dependencies = readLocationDeleteDependencySummary(
          session,
          operation.locationId
        );
        const dependencyLabels = locationDeleteDependencyLabels(dependencies);
        if (dependencyLabels.length > 0) {
          issues.push(
            locationDeleteDependencyIssue({
              dependencyLabels,
              path: [...operationPath, 'locationId'],
            })
          );
        }
        if (hasScreenplayReferences || dependencyLabels.length > 0) {
          return;
        }
        draft.splice(index, 1);
        changes.push({ operation: operation.operation, locationId: operation.locationId });
      }
      if (operation.operation === 'location.move') {
        draft.splice(
          0,
          draft.length,
          ...moveByPlacement(draft, operation.locationId, operation.placement, 'Location')
        );
        changes.push({ operation: operation.operation, locationId: operation.locationId });
      }
    });

    validateLocationDraft({ locations: draft, castHandles, issues, warnings });
    throwIfDepartmentIssues(issues);

    if (!input.dryRun) {
      session.db.transaction((tx) => {
        const txSession = { ...session, db: tx };
        replaceLocationAuthoringRecords(txSession, draft);
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
      resourceKeys: locationResourceKeysForChanges(changes),
    };
  });
}

export function locationResourceKeys(locationId?: string): string[] {
  return [
    studioLocationNavigationResourceKey(),
    ...(locationId
      ? [
          studioLocationSurfaceResourceKey(locationId),
          studioLocationDesignResourceKey(locationId),
        ]
      : []),
  ];
}

function listLocationsFromSession(session: DatabaseSession): Location[] {
  return listLocationRecords(session).map((row) => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      timePeriod: row.timePeriod ?? undefined,
      description: row.description ?? undefined,
      visualNotes: row.visualNotes ?? undefined,
    }));
}

function requireLocation(session: DatabaseSession, locationId: string): Location {
  const location = listLocationsFromSession(session).find(
    (candidate) => candidate.id === locationId
  );
  if (!location) {
    throw new ProjectDataError('PROJECT_DATA205', 'Location was not found.', {
      suggestion: 'Check the id from `renku location list --json`.',
    });
  }
  return location;
}

function toLocation(input: LocationInput): Location {
  if (!input.id) {
    throw new ProjectDataError('PROJECT_DATA206', 'Location requires id.', {
      suggestion: 'Use key for adds and id for updates.',
    });
  }
  return {
    id: input.id,
    handle: input.handle,
    name: input.name,
    timePeriod: input.timePeriod,
    description: input.description,
    visualNotes: input.visualNotes,
  };
}

function validateLocationDraft(input: {
  locations: Location[];
  castHandles: Map<string, string>;
  issues: DiagnosticIssue[];
  warnings: DiagnosticIssue[];
}): void {
  const handles = new Map<string, string[]>();
  input.castHandles.forEach((_castMemberId, handle) => {
    handles.set(handle, ['cast', handle]);
  });
  const names = new Map<string, string[]>();
  input.locations.forEach((location, index) => {
    const path = ['locations', String(index)];
    const firstHandlePath = handles.get(location.handle);
    if (firstHandlePath) {
      input.issues.push(
        createDiagnosticError(
          'PROJECT_DATA209',
          `Duplicate handle: ${location.handle}.`,
          { path: [...path, 'handle'], context: `First seen at ${firstHandlePath.join('.')}` },
          'Use a unique handle across cast and locations.'
        )
      );
    } else {
      handles.set(location.handle, [...path, 'handle']);
    }
    const normalizedName = location.name.trim().toLocaleLowerCase();
    const firstNamePath = names.get(normalizedName);
    if (firstNamePath) {
      input.warnings.push(
        createDiagnosticWarning(
          'PROJECT_DATA215',
          `Likely duplicate location name: ${location.name}.`,
          { path: [...path, 'name'], context: `First seen at ${firstNamePath.join('.')}` },
          'Update the existing location when this is the same place.'
        )
      );
    } else {
      names.set(normalizedName, [...path, 'name']);
    }
  });
}

function locationResourceKeysForChanges(changes: DepartmentCommandChange[]): string[] {
  const keys = new Set(locationResourceKeys());
  changes.forEach((change) => {
    const locationId = change.locationId;
    if (typeof locationId === 'string') {
      locationResourceKeys(locationId).forEach((key) => keys.add(key));
    }
  });
  return [...keys];
}

function locationScenes(
  screenplay: NonNullable<ReturnType<typeof readScreenplayDocumentFromSession>>,
  locationId: string
): ProductionDesignLocationContextReport['scenes'] {
  const scenes: ProductionDesignLocationContextReport['scenes'] = [];
  screenplay.acts.forEach((act) =>
    act.sequences.forEach((sequence) =>
      sequence.scenes.forEach((scene) => {
        const referenced =
          scene.setting.locationIds?.includes(locationId) ||
          scene.blocks.some((block) => block.locationIds?.includes(locationId));
        if (referenced) {
          scenes.push({
            sceneId: scene.id as string,
            sequenceId: sequence.id as string,
            sequenceTitle: sequence.title,
            title: scene.title,
            setting: scene.setting,
            storyFunction: scene.storyFunction ?? [],
            excerpts: scene.blocks.map((block) =>
              block.type === 'dialogue' ? block.lines.join(' ') : block.text
            ),
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

function locationDeleteDependencyIssue(input: {
  dependencyLabels: string[];
  path: string[];
}): DiagnosticIssue {
  return createDiagnosticError(
    'PROJECT_DATA217',
    `Location has dependent ${joinDependencyLabels(input.dependencyLabels)}.`,
    { path: input.path },
    'Remove or reassign dependent Location assets, Location Designs, and environment sheets before deleting this location.'
  );
}

function locationDeleteDependencyLabels(
  dependencies: LocationDeleteDependencySummary
): string[] {
  return [
    dependencies.assetCount > 0
      ? pluralizeDependency('Location asset', dependencies.assetCount)
      : null,
    dependencies.designCount > 0
      ? pluralizeDependency('Location Design', dependencies.designCount)
      : null,
    dependencies.activeDesignStateCount > 0 ? 'active Location Design state' : null,
    dependencies.environmentSheetCount > 0
      ? pluralizeDependency(
          'location environment sheet',
          dependencies.environmentSheetCount
        )
      : null,
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
