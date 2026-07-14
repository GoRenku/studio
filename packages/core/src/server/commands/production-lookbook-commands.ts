import type {
  LookbookValidationReport,
  LookbookWriteReport,
  VisualLanguageProjectReport,
} from '../../client/index.js';
import {
  insertLookbookRecord,
  readLookbookRecordByKind,
  requireLookbookRecordByKind,
  toLookbook,
  updateLookbookRecord,
} from '../database/access/lookbook.js';
import { requireInspirationFolderRecord } from '../database/access/inspiration-folders.js';
import {
  listLookbookSourceInspirationFolders,
  replaceLookbookInspirationRecords,
} from '../database/access/lookbook-inspirations.js';
import { readProjectRecord, type ProjectRecord } from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../entity-ids.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import type {
  ValidateProductionLookbookInput,
  WriteProductionLookbookInput,
} from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  serializeLookbookDocument,
  validateLookbookDocument,
} from '../visual-language-json/validator.js';
import {
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../studio-coordination/resource-keys.js';

export async function validateProductionLookbook(
  input: ValidateProductionLookbookInput
): Promise<LookbookValidationReport> {
  return withSession(input, ({ session, projectFolder, project }) => {
    assertProductionDocument(input.document);
    validateLookbookDocument(input);
    const folderIds = input.document.sourceInspirationFolderIds ?? [];
    assertInspirationFolders(session, folderIds);
    return {
      valid: true,
      warnings: [],
      project: projectReport(project, projectFolder),
      sourceInspirationFolders: folderIds.map((id) => {
        const folder = requireInspirationFolderRecord(session, id);
        const projectRelativePath = normalizeProjectRelativePath(folder.projectRelativePath);
        return {
          ...folder,
          projectRelativePath,
          absolutePath: resolveProjectRelativePath(
            projectFolder,
            projectRelativePath
          ),
        };
      }),
      resourceKeys: [studioVisualLanguageLookbooksResourceKey()],
    };
  });
}

export async function writeProductionLookbook(
  input: WriteProductionLookbookInput
): Promise<LookbookWriteReport> {
  return withSession(input, ({ session, projectFolder, project }) => {
    assertProductionDocument(input.document);
    const document = serializeLookbookDocument(input);
    const folderIds = document.sourceInspirationFolderIds;
    if (folderIds) {
      assertInspirationFolders(session, folderIds);
    }
    const existing = readLookbookRecordByKind(session, 'production');
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const lookbookId = existing?.id ?? ids('lookbook');
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      if (existing) {
        updateLookbookRecord(txSession, {
          lookbookId,
          name: normalizeName(document.name),
          definitionJson: document.definitionJson,
          now,
        });
      } else {
        insertLookbookRecord(txSession, {
          id: lookbookId,
          name: normalizeName(document.name),
          kind: 'production',
          definitionJson: document.definitionJson,
          now,
        });
      }
      if (folderIds || !existing) {
        replaceLookbookInspirationRecords(txSession, {
          lookbookId,
          inspirationFolderIds: folderIds ?? [],
          nextId: () => ids('lookbook_inspiration'),
          now,
        });
      }
    });
    return writeReport(
      session,
      projectFolder,
      project,
      lookbookId,
      existing ? 'updated' : 'created'
    );
  });
}

function assertProductionDocument(document: { kind: string }): void {
  if (document.kind !== 'productionLookbook') {
    throw new ProjectDataError(
      'CORE_LOOKBOOK_TARGET_KIND_INVALID',
      'Production Lookbook commands require a productionLookbook document.'
    );
  }
}

function writeReport(
  session: DatabaseSession,
  projectFolder: string,
  project: Pick<ProjectRecord, 'id' | 'name'>,
  lookbookId: string,
  change: 'created' | 'updated'
): LookbookWriteReport {
  return {
    valid: true,
    warnings: [],
    project: projectReport(project, projectFolder),
    changes: [{ type: `lookbook.${change}`, lookbookId }],
    lookbook: toLookbook(requireLookbookRecordByKind(session, 'production')),
    sourceInspirationFolders: listLookbookSourceInspirationFolders(session, {
      projectFolder,
      lookbookId,
    }),
    resourceKeys: [
      studioVisualLanguageLookbooksResourceKey(),
      studioVisualLanguageLookbookResourceKey(lookbookId),
    ],
  };
}

function assertInspirationFolders(session: DatabaseSession, folderIds: string[]): void {
  if (new Set(folderIds).size !== folderIds.length) {
    throw new ProjectDataError(
      'CORE_LOOKBOOK_SOURCE_DUPLICATE',
      'Lookbook source Inspiration folder ids must be unique.'
    );
  }
  folderIds.forEach((id) => requireInspirationFolderRecord(session, id));
}

function normalizeName(name: string): string {
  const value = name.trim();
  if (!value) {
    throw new ProjectDataError('CORE_LOOKBOOK_NAME_REQUIRED', 'Lookbook name is required.');
  }
  return value;
}

async function withSession<T>(
  input: { projectName?: string; homeDir?: string },
  fn: (handle: {
    projectFolder: string;
    project: Pick<ProjectRecord, 'id' | 'name'>;
    session: DatabaseSession;
  }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn({
        ...handle,
        project: requireProject(handle.session),
      });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) => fn({
    projectFolder: currentProject.projectFolder,
    project: { id: currentProject.projectId, name: currentProject.projectName },
    session,
  }));
}

function requireProject(session: DatabaseSession): ProjectRecord {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return project;
}

function projectReport(
  project: Pick<ProjectRecord, 'id' | 'name'>,
  projectFolder: string
): VisualLanguageProjectReport {
  return { id: project.id, name: project.name, projectFolder };
}
