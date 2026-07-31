import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  createDiagnosticError,
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import type { Prop } from '../../client/props.js';
import type {
  DepartmentCommandChange,
  DepartmentCommandReport,
  DepartmentGeneratedId,
  ProductionDesignPropContextReport,
  PropInput,
  PropOperationDocument,
} from '../../client/department-design.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import { listLocationRecords } from '../database/access/locations.js';
import {
  listPropAssetRoleRecords,
  listPropRecords,
  readPropDeleteDependencySummary,
  replacePropAuthoringRecords,
  type PropDeleteDependencySummary,
} from '../database/access/props.js';
import {
  readActivePropDesignDocument,
  toPropDesignSummary,
} from '../database/access/prop-designs.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { assertPropOperationDocument } from '../department-design-json/validator.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import {
  studioProjectShellResourceKey,
  studioPropNavigationResourceKey,
  studioPropSurfaceResourceKey,
} from '../studio-coordination/resource-keys.js';
import { listAssetsInSession } from '../assets/projection.js';
import {
  allocateDepartmentId,
  applyPlacement,
  assertExistingObjectUsesId,
  assertNewObjectUsesKey,
  moveByPlacement,
  projectSummary,
  throwIfDepartmentIssues,
} from './department-command-support.js';

export async function listProps(
  input: RenkuConfigPathOptions = {}
): Promise<Prop[]> {
  return await withCurrentProjectSession(input, ({ session }) =>
    listPropsFromSession(session)
  );
}

export async function readProp(
  input: RenkuConfigPathOptions & { propId: string }
): Promise<Prop> {
  return await withCurrentProjectSession(input, ({ session }) =>
    requireProp(session, input.propId)
  );
}

export async function readPropContext(
  input: RenkuConfigPathOptions & { propId: string }
): Promise<ProductionDesignPropContextReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const prop = requireProp(session, input.propId);
    const activeDesign = readActivePropDesignDocument(session, input.propId);
    const assetRoles = listPropAssetRoleRecords(session, input.propId);
    const assets = listAssetsInSession(session, {
      owner: { kind: 'prop', id: input.propId },
    });
    const assetTypeCounts = typeCounts(assetRoles);
    return {
      valid: true,
      warnings: [],
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: propResourceKeys(input.propId),
      prop,
      activeDesign: activeDesign?.document ?? null,
      activeDesignSummary: activeDesign
        ? toPropDesignSummary({ id: activeDesign.id, document: activeDesign.document })
        : null,
      activeLookbook: null,
      assets,
      assetTypeCounts,
      generationReadiness: {
        propSheet: true,
        propHero: assetTypeCounts.some((entry) => entry.type === 'prop_sheet'),
        notes: ['Use media-producer for prop.sheet and prop.hero generation.'],
      },
    };
  });
}

export async function validatePropOperations(
  input: RenkuConfigPathOptions & {
    document: PropOperationDocument;
    filePath?: string;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<DepartmentCommandReport> {
  return await applyPropOperations({ ...input, dryRun: true });
}

export async function applyPropOperations(
  input: RenkuConfigPathOptions & {
    document: PropOperationDocument;
    filePath?: string;
    dryRun?: boolean;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<DepartmentCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertPropOperationDocument({
      document: input.document,
      filePath: input.filePath,
    });
    const draft = listPropsFromSession(session);
    const generatedIds: DepartmentGeneratedId[] = [];
    const changes: DepartmentCommandChange[] = [];
    const issues: DiagnosticIssue[] = [];

    input.document.operations.forEach((operation, operationIndex) => {
      const operationPath = ['operations', String(operationIndex)];
      if (operation.operation === 'prop.add') {
        assertNewObjectUsesKey({
          id: operation.prop.id,
          key: operation.prop.key,
          path: [...operationPath, 'prop'],
          label: 'prop',
          issues,
        });
        if (issues.length > 0) {
          return;
        }
        const id = allocateDepartmentId({
          prefix: 'prop',
          key: operation.prop.key as string,
          kind: 'prop',
          path: [...operationPath, 'prop', 'key'],
          idGenerator: input.idGenerator,
          generatedIds,
        });
        const prop = toProp({ ...operation.prop, id });
        draft.splice(0, draft.length, ...applyPlacement(draft, prop, operation.placement));
        changes.push({ operation: operation.operation, propId: id });
      }
      if (operation.operation === 'prop.update') {
        assertExistingObjectUsesId({
          id: operation.prop.id,
          key: operation.prop.key,
          path: [...operationPath, 'prop'],
          label: 'prop',
          issues,
        });
        const id = operation.prop.id;
        const index = id ? draft.findIndex((prop) => prop.id === id) : -1;
        if (id && index === -1) {
          issues.push(notFoundIssue([...operationPath, 'prop', 'id']));
          return;
        }
        if (id && index !== -1) {
          draft[index] = toProp(operation.prop);
          changes.push({ operation: operation.operation, propId: id });
        }
      }
      if (operation.operation === 'prop.delete') {
        const index = draft.findIndex((prop) => prop.id === operation.propId);
        if (index === -1) {
          issues.push(notFoundIssue([...operationPath, 'propId']));
          return;
        }
        const dependencyLabels = propDeleteDependencyLabels(
          readPropDeleteDependencySummary(session, operation.propId)
        );
        if (dependencyLabels.length > 0) {
          issues.push(
            createDiagnosticError(
              'CORE_PROP_DELETE_BLOCKED',
              `Prop has dependent ${joinDependencyLabels(dependencyLabels)}.`,
              { path: [...operationPath, 'propId'] },
              'Remove dependent Prop Assets and Prop Designs before deleting this Prop.'
            )
          );
          return;
        }
        draft.splice(index, 1);
        changes.push({ operation: operation.operation, propId: operation.propId });
      }
      if (operation.operation === 'prop.move') {
        draft.splice(
          0,
          draft.length,
          ...moveByPlacement(draft, operation.propId, operation.placement, 'Prop')
        );
        changes.push({ operation: operation.operation, propId: operation.propId });
      }
    });

    validatePropDraft(session, draft, issues, warnings);
    throwIfDepartmentIssues(issues);

    if (!input.dryRun) {
      session.db.transaction((tx) => {
        replacePropAuthoringRecords({ ...session, db: tx }, draft);
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
      resourceKeys: propResourceKeysForChanges(changes),
    };
  });
}

export function propResourceKeys(propId?: string): string[] {
  return [
    studioPropNavigationResourceKey(),
    ...(propId ? [studioPropSurfaceResourceKey(propId)] : []),
  ];
}

function listPropsFromSession(session: DatabaseSession): Prop[] {
  return listPropRecords(session).map((row) => ({
    id: row.id,
    handle: row.handle,
    name: row.name,
    description: row.description ?? undefined,
    visualNotes: row.visualNotes ?? undefined,
  }));
}

function requireProp(session: DatabaseSession, propId: string): Prop {
  const prop = listPropsFromSession(session).find((candidate) => candidate.id === propId);
  if (!prop) {
    throw new ProjectDataError('PROJECT_DATA205', 'Prop was not found.', {
      suggestion: 'Check the id from `renku prop list --json`.',
    });
  }
  return prop;
}

function toProp(input: PropInput): Prop {
  if (!input.id) {
    throw new ProjectDataError('PROJECT_DATA206', 'Prop requires id.', {
      suggestion: 'Use key for adds and id for updates.',
    });
  }
  return {
    id: input.id,
    handle: input.handle,
    name: input.name,
    description: input.description,
    visualNotes: input.visualNotes,
  };
}

function validatePropDraft(
  session: DatabaseSession,
  props: Prop[],
  issues: DiagnosticIssue[],
  warnings: DiagnosticIssue[]
): void {
  const handles = new Map<string, string[]>();
  listCastMemberRecords(session).forEach((record) => handles.set(record.handle, ['cast', record.id]));
  listLocationRecords(session).forEach((record) => handles.set(record.handle, ['locations', record.id]));
  const names = new Map<string, string[]>();
  props.forEach((prop, index) => {
    const path = ['props', String(index)];
    const firstHandlePath = handles.get(prop.handle);
    if (firstHandlePath) {
      issues.push(createDiagnosticError(
        'PROJECT_DATA209',
        `Duplicate handle: ${prop.handle}.`,
        { path: [...path, 'handle'], context: `First seen at ${firstHandlePath.join('.')}` },
        'Use a unique handle across Cast Members, Locations, and Props.'
      ));
    } else {
      handles.set(prop.handle, [...path, 'handle']);
    }
    const normalizedName = prop.name.trim().toLocaleLowerCase();
    const firstNamePath = names.get(normalizedName);
    if (firstNamePath) {
      warnings.push(createDiagnosticWarning(
        'PROJECT_DATA215',
        `Likely duplicate Prop name: ${prop.name}.`,
        { path: [...path, 'name'], context: `First seen at ${firstNamePath.join('.')}` },
        'Update the existing Prop when this is the same continuity subject.'
      ));
    } else {
      names.set(normalizedName, [...path, 'name']);
    }
  });
}

function propResourceKeysForChanges(changes: DepartmentCommandChange[]): string[] {
  const keys = new Set([studioProjectShellResourceKey(), ...propResourceKeys()]);
  changes.forEach((change) => {
    if (typeof change.propId === 'string') {
      propResourceKeys(change.propId).forEach((key) => keys.add(key));
    }
  });
  return [...keys];
}

function typeCounts(records: Array<{ type: string }>): Array<{ type: string; count: number }> {
  const counts = new Map<string, { type: string; count: number }>();
  records.forEach((record) => {
    const count = counts.get(record.type) ?? { type: record.type, count: 0 };
    count.count += 1;
    counts.set(record.type, count);
  });
  return [...counts.values()];
}

function propDeleteDependencyLabels(dependencies: PropDeleteDependencySummary): string[] {
  return [
    dependencies.assetCount > 0 ? pluralizeDependency('Prop Asset', dependencies.assetCount) : null,
    dependencies.designCount > 0 ? pluralizeDependency('Prop Design', dependencies.designCount) : null,
    dependencies.activeDesignStateCount > 0 ? 'active Prop Design state' : null,
    dependencies.propSheetCount > 0 ? pluralizeDependency('Prop Sheet', dependencies.propSheetCount) : null,
  ].filter(isString);
}

function joinDependencyLabels(labels: string[]): string {
  return labels.length <= 1
    ? labels[0] ?? 'records'
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function pluralizeDependency(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function isString(value: string | null): value is string {
  return value !== null;
}

function notFoundIssue(path: string[]): DiagnosticIssue {
  return createDiagnosticError(
    'PROJECT_DATA205',
    'Prop was not found.',
    { path },
    'Check the id from the latest Prop list command.'
  );
}
