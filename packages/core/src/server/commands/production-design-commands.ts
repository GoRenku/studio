import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  DepartmentCommandReport,
  LocationDesignDocument,
  LocationDesignListReport,
  LocationDesignReadReport,
  LocationDesignWriteReport,
} from '../../client/department-design.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../entity-ids.js';
import { readLocationRecord } from '../database/access/locations.js';
import {
  listLocationDesignRecords,
  readActiveLocationDesignDocument,
  readActiveLocationDesignId,
  readLocationDesignDocumentById,
  setActiveLocationDesignRecord,
  writeLocationDesignRecord,
} from '../database/access/department-design.js';
import { assertLocationDesignDocument } from '../department-design-json/validator.js';
import { ProjectDataError } from '../project-data-error.js';
import { projectSummary, throwIfDepartmentIssues } from './department-command-support.js';
import { locationResourceKeys } from './location-commands.js';
import type { Location } from '../../client/locations.js';

export async function listLocationDesigns(
  input: RenkuConfigPathOptions & { locationId: string }
): Promise<LocationDesignListReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const location = requireLocation(input.locationId, session);
    return {
      valid: true,
      warnings: [],
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: locationResourceKeys(input.locationId),
      location,
      designs: listLocationDesignRecords(session, input.locationId),
      activeDesignId: readActiveLocationDesignId(session, input.locationId),
    };
  });
}

export async function readLocationDesign(
  input: RenkuConfigPathOptions & {
    locationId?: string;
    designId?: string;
    active?: boolean;
  }
): Promise<LocationDesignReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const design = input.active
      ? readActiveLocationDesignDocument(session, requiredLocationId(input))
      : readLocationDesignDocumentById(session, requiredDesignId(input.designId), input.locationId);
    const locationId = design?.document.locationId ?? requiredLocationId(input);
    const location = requireLocation(locationId, session);
    return {
      valid: true,
      warnings: [],
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: locationResourceKeys(locationId),
      location,
      design: design?.document ?? null,
      summary: design?.summary ?? null,
      activeDesignId: readActiveLocationDesignId(session, locationId),
    };
  });
}

export async function validateLocationDesign(
  input: RenkuConfigPathOptions & { document: LocationDesignDocument; filePath?: string }
): Promise<DepartmentCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertLocationDesignDocument({
      document: input.document,
      filePath: input.filePath,
    });
    assertLocationDesignSemantics(session, input.document);
    return {
      valid: true,
      warnings,
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: locationResourceKeys(input.document.locationId),
    };
  });
}

export async function writeLocationDesign(
  input: RenkuConfigPathOptions & {
    document: LocationDesignDocument;
    filePath?: string;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<LocationDesignWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertLocationDesignDocument({
      document: input.document,
      filePath: input.filePath,
    });
    assertLocationDesignSemantics(session, input.document);
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const designId = ids('location_design');
    writeLocationDesignRecord({
      session,
      id: designId,
      document: input.document,
      sourceCommand: 'production-design.location.write',
      now: new Date().toISOString(),
    });
    return {
      valid: true,
      warnings,
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: locationResourceKeys(input.document.locationId),
      changes: [{ operation: 'locationDesign.write', locationId: input.document.locationId, designId }],
      generatedIds: [{ kind: 'locationDesign', path: ['locationId'], key: input.document.locationId, id: designId }],
      location: requireLocation(input.document.locationId, session),
      design: input.document,
      designId,
      activeDesignId: designId,
    };
  });
}

export async function setActiveLocationDesign(
  input: RenkuConfigPathOptions & { locationId: string; designId: string }
): Promise<LocationDesignWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const location = requireLocation(input.locationId, session);
    const design = readLocationDesignDocumentById(session, input.designId, input.locationId);
    setActiveLocationDesignRecord(session, {
      locationId: input.locationId,
      designId: input.designId,
      now: new Date().toISOString(),
    });
    return {
      valid: true,
      warnings: [],
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: locationResourceKeys(input.locationId),
      changes: [{ operation: 'locationDesign.setActive', locationId: input.locationId, designId: input.designId }],
      location,
      design: design.document,
      designId: input.designId,
      activeDesignId: input.designId,
    };
  });
}

function assertLocationDesignSemantics(
  session: DatabaseSession,
  document: LocationDesignDocument
): void {
  requireLocation(document.locationId, session);
  const issues: DiagnosticIssue[] = [];
  const propNames = new Set<string>();
  document.design.propsAndRecurringObjects.forEach((prop, index) => {
    const name = prop.name.trim().toLocaleLowerCase();
    if (propNames.has(name)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA209',
          `Duplicate production design prop name: ${prop.name}.`,
          { path: ['design', 'propsAndRecurringObjects', String(index), 'name'] },
          'Use unique prop names inside one Location Design.'
        )
      );
    }
    propNames.add(name);
  });
  throwIfDepartmentIssues(issues);
}

function requireLocation(locationId: string, session: DatabaseSession): Location {
  const row = readLocationRecord(session, locationId);
  if (!row) {
    throw new ProjectDataError('PROJECT_DATA205', 'Location was not found.', {
      suggestion: 'Check the id from `renku location list --json`.',
    });
  }
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    timePeriod: row.timePeriod ?? undefined,
    description: row.description ?? undefined,
    visualNotes: row.visualNotes ?? undefined,
  };
}

function requiredLocationId(input: { locationId?: string }): string {
  if (input.locationId) {
    return input.locationId;
  }
  throw new ProjectDataError('PROJECT_DATA206', 'Location id is required.', {
    suggestion: 'Pass --location with --active, or pass --design for a specific design.',
  });
}

function requiredDesignId(designId: string | undefined): string {
  if (designId) {
    return designId;
  }
  throw new ProjectDataError('PROJECT_DATA206', 'Location Design id is required.', {
    suggestion: 'Pass --design, or use --active with --location.',
  });
}
