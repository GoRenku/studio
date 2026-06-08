import type {
  CastDesignDocument,
  CastDesignListReport,
  CastDesignReadReport,
  CastDesignWriteReport,
  DepartmentCommandReport,
} from '../../client/department-design.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../entity-ids.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import {
  listCastDesignRecords,
  readActiveCastDesignDocument,
  readActiveCastDesignId,
  readCastDesignDocumentById,
  setActiveCastDesignRecord,
  writeCastDesignRecord,
} from '../database/access/department-design.js';
import { assertCastDesignDocument } from '../department-design-json/validator.js';
import { ProjectDataError } from '../project-data-error.js';
import { projectSummary, throwIfDepartmentIssues } from './department-command-support.js';
import { castResourceKeys } from './cast-commands.js';
import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export async function listCastDesigns(
  input: RenkuConfigPathOptions & { castMemberId: string }
): Promise<CastDesignListReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const castMember = requireCastMember(input.castMemberId, session);
    return {
      valid: true,
      warnings: [],
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: castResourceKeys(input.castMemberId),
      castMember,
      designs: listCastDesignRecords(session, input.castMemberId),
      activeDesignId: readActiveCastDesignId(session, input.castMemberId),
    };
  });
}

export async function readCastDesign(
  input: RenkuConfigPathOptions & {
    castMemberId?: string;
    designId?: string;
    active?: boolean;
  }
): Promise<CastDesignReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const design = input.active
      ? readActiveCastDesignDocument(session, requiredCastMemberId(input))
      : readCastDesignDocumentById(session, requiredDesignId(input.designId), input.castMemberId);
    const castMemberId = design?.document.castMemberId ?? requiredCastMemberId(input);
    const castMember = requireCastMember(castMemberId, session);
    const activeDesignId = readActiveCastDesignId(session, castMemberId);
    return {
      valid: true,
      warnings: [],
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: castResourceKeys(castMemberId),
      castMember,
      design: design?.document ?? null,
      summary: design?.summary ?? null,
      activeDesignId,
    };
  });
}

export async function validateCastDesign(
  input: RenkuConfigPathOptions & { document: CastDesignDocument; filePath?: string }
): Promise<DepartmentCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertCastDesignDocument({
      document: input.document,
      filePath: input.filePath,
    });
    assertCastDesignSemantics(session, input.document);
    return {
      valid: true,
      warnings,
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: castResourceKeys(input.document.castMemberId),
    };
  });
}

export async function writeCastDesign(
  input: RenkuConfigPathOptions & {
    document: CastDesignDocument;
    filePath?: string;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<CastDesignWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = assertCastDesignDocument({
      document: input.document,
      filePath: input.filePath,
    });
    assertCastDesignSemantics(session, input.document);
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const designId = ids('cast_design');
    const now = new Date().toISOString();
    writeCastDesignRecord({
      session,
      id: designId,
      document: input.document,
      sourceCommand: 'cast.design.write',
      now,
    });
    return {
      valid: true,
      warnings,
      project: projectSummary({
        projectName: currentProject.projectName,
        projectId: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      }),
      resourceKeys: castResourceKeys(input.document.castMemberId),
      changes: [{ operation: 'castDesign.write', castMemberId: input.document.castMemberId, designId }],
      generatedIds: [
        {
          kind: 'castDesign',
          path: ['castMemberId'],
          key: input.document.castMemberId,
          id: designId,
        },
      ],
      castMember: requireCastMember(input.document.castMemberId, session),
      design: input.document,
      designId,
      activeDesignId: designId,
    };
  });
}

export async function setActiveCastDesign(
  input: RenkuConfigPathOptions & { castMemberId: string; designId: string }
): Promise<CastDesignWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const castMember = requireCastMember(input.castMemberId, session);
    const design = readCastDesignDocumentById(session, input.designId, input.castMemberId);
    setActiveCastDesignRecord(session, {
      castMemberId: input.castMemberId,
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
      resourceKeys: castResourceKeys(input.castMemberId),
      changes: [{ operation: 'castDesign.setActive', castMemberId: input.castMemberId, designId: input.designId }],
      castMember,
      design: design.document,
      designId: input.designId,
      activeDesignId: input.designId,
    };
  });
}

function assertCastDesignSemantics(
  session: DatabaseSession,
  document: CastDesignDocument
): void {
  requireCastMember(document.castMemberId, session);
  const screenplay = readScreenplayDocumentFromSession(session);
  const issues: DiagnosticIssue[] = [];
  const sequenceIds = new Set<string>();
  const sceneIds = new Set<string>();
  screenplay?.acts.forEach((act) =>
    act.sequences.forEach((sequence) => {
      if (sequence.id) {
        sequenceIds.add(sequence.id);
      }
      sequence.scenes.forEach((scene) => {
        if (scene.id) {
          sceneIds.add(scene.id);
        }
      });
    })
  );
  const variantLabels = new Set<string>();
  document.design.costume.variants.forEach((variant, index) => {
    const labelKey = variant.label.trim().toLocaleLowerCase();
    if (variantLabels.has(labelKey)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA209',
          `Duplicate costume variant label: ${variant.label}.`,
          { path: ['design', 'costume', 'variants', String(index), 'label'] },
          'Use unique costume variant labels inside one Cast Design.'
        )
      );
    }
    variantLabels.add(labelKey);
    if (variant.scope.kind === 'sequence' && !sequenceIds.has(variant.scope.sequenceId)) {
      issues.push(scopeIssue(['design', 'costume', 'variants', String(index), 'scope', 'sequenceId']));
    }
    if (variant.scope.kind === 'scene' && !sceneIds.has(variant.scope.sceneId)) {
      issues.push(scopeIssue(['design', 'costume', 'variants', String(index), 'scope', 'sceneId']));
    }
  });
  throwIfDepartmentIssues(issues);
}

function requireCastMember(castMemberId: string, session: DatabaseSession) {
  const row = readCastMemberRecord(session, castMemberId);
  if (!row) {
    throw new ProjectDataError('PROJECT_DATA205', 'Cast member was not found.', {
      suggestion: 'Check the id from `renku cast list --json`.',
    });
  }
  return {
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
  };
}

function requiredCastMemberId(input: { castMemberId?: string; active?: boolean }): string {
  if (input.castMemberId) {
    return input.castMemberId;
  }
  throw new ProjectDataError('PROJECT_DATA206', 'Cast Design show requires cast member id.', {
    suggestion: 'Pass --cast with --active, or pass --design for a specific design.',
  });
}

function requiredDesignId(designId: string | undefined): string {
  if (designId) {
    return designId;
  }
  throw new ProjectDataError('PROJECT_DATA206', 'Cast Design id is required.', {
    suggestion: 'Pass --design, or use --active with --cast.',
  });
}

function scopeIssue(path: string[]) {
  return createDiagnosticError(
    'PROJECT_DATA210',
    'Cast Design scope references an unknown sequence or scene.',
    { path },
    'Use ids from the latest screenplay read command.'
  );
}
