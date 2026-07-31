import type {
  DepartmentCommandReport,
  PropDesignDocument,
  PropDesignListReport,
  PropDesignReadReport,
  PropDesignWriteReport,
} from '../../client/department-design.js';
import type { Prop } from '../../client/props.js';
import {
  listPropDesignRecords,
  readActivePropDesignDocument,
  readActivePropDesignId,
  readPropDesignDocumentById,
  setActivePropDesignRecord,
  writePropDesignRecord,
} from '../database/access/prop-designs.js';
import { readPropRecord } from '../database/access/props.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { assertPropDesignDocument } from '../department-design-json/validator.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { projectSummary } from './department-command-support.js';
import { propResourceKeys } from './prop-commands.js';

export async function listPropDesigns(
  input: RenkuConfigPathOptions & { propId: string }
): Promise<PropDesignListReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const prop = requireProp(input.propId, session);
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
      designs: listPropDesignRecords(session, input.propId),
      activeDesignId: readActivePropDesignId(session, input.propId),
    };
  });
}

export async function readPropDesign(
  input: RenkuConfigPathOptions & {
    propId?: string;
    designId?: string;
    active?: boolean;
  }
): Promise<PropDesignReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const design = input.active
      ? readActivePropDesignDocument(session, requiredPropId(input))
      : readPropDesignDocumentById(session, requiredDesignId(input.designId), input.propId);
    const propId = design?.document.propId ?? requiredPropId(input);
    return {
      valid: true,
      warnings: [],
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: propResourceKeys(propId),
      prop: requireProp(propId, session),
      design: design?.document ?? null,
      summary: design?.summary ?? null,
      activeDesignId: readActivePropDesignId(session, propId),
    };
  });
}

export async function validatePropDesign(
  input: RenkuConfigPathOptions & {
    document: PropDesignDocument;
    filePath?: string;
  }
): Promise<DepartmentCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertPropDesignDocument({
      document: input.document,
      filePath: input.filePath,
    });
    requireProp(input.document.propId, session);
    return {
      valid: true,
      warnings,
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: propResourceKeys(input.document.propId),
    };
  });
}

export async function writePropDesign(
  input: RenkuConfigPathOptions & {
    document: PropDesignDocument;
    filePath?: string;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<PropDesignWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertPropDesignDocument({
      document: input.document,
      filePath: input.filePath,
    });
    const prop = requireProp(input.document.propId, session);
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const designId = ids('prop_design');
    writePropDesignRecord({
      session,
      id: designId,
      document: input.document,
      sourceCommand: 'production-design.prop.write',
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
      resourceKeys: propResourceKeys(input.document.propId),
      changes: [{
        operation: 'propDesign.write',
        propId: input.document.propId,
        designId,
      }],
      generatedIds: [{
        kind: 'propDesign',
        path: ['propId'],
        key: input.document.propId,
        id: designId,
      }],
      prop,
      design: input.document,
      designId,
      activeDesignId: designId,
    };
  });
}

export async function setActivePropDesign(
  input: RenkuConfigPathOptions & { propId: string; designId: string }
): Promise<PropDesignWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const prop = requireProp(input.propId, session);
    const design = readPropDesignDocumentById(session, input.designId, input.propId);
    setActivePropDesignRecord(session, {
      propId: input.propId,
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
      resourceKeys: propResourceKeys(input.propId),
      changes: [{
        operation: 'propDesign.setActive',
        propId: input.propId,
        designId: input.designId,
      }],
      prop,
      design: design.document,
      designId: input.designId,
      activeDesignId: input.designId,
    };
  });
}

function requireProp(propId: string, session: DatabaseSession): Prop {
  const row = readPropRecord(session, propId);
  if (!row) {
    throw new ProjectDataError('PROJECT_DATA205', 'Prop was not found.', {
      suggestion: 'Check the id from `renku prop list --json`.',
    });
  }
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    description: row.description ?? undefined,
    visualNotes: row.visualNotes ?? undefined,
  };
}

function requiredPropId(input: { propId?: string }): string {
  if (input.propId) {
    return input.propId;
  }
  throw new ProjectDataError('PROJECT_DATA206', 'Prop id is required.', {
    suggestion: 'Pass --prop with --active, or pass --design for a specific design.',
  });
}

function requiredDesignId(designId: string | undefined): string {
  if (designId) {
    return designId;
  }
  throw new ProjectDataError('PROJECT_DATA206', 'Prop Design id is required.', {
    suggestion: 'Pass --design, or use --active with --prop.',
  });
}
