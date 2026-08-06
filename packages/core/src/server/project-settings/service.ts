import type {
  ProjectSettingsMutationReport,
  ProjectSettingsResource,
} from '../../client/project-settings.js';
import {
  readProjectSettingsRecord,
  replaceProjectSettingsRecord,
} from '../database/access/project-settings.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectRecord } from '../database/access/project.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioProjectSettingsResourceKey } from '../studio-coordination/resource-keys.js';
import {
  parseStoredProjectSettings,
  serializeProjectSettings,
  validateProjectSettingsDocument,
} from './document.js';

export async function readProjectSettings(
  input: ReadProjectInput
): Promise<ProjectSettingsResource> {
  const { session } = await openProjectSession(input);
  return readProjectSettingsFromSession(session);
}

export async function replaceProjectSettings(
  input: ReadProjectInput & { settings: unknown }
): Promise<ProjectSettingsMutationReport> {
  const { session } = await openProjectSession(input);
  const settings = validateProjectSettingsDocument(input.settings);
  readRequiredProjectSettingsRecord(session);
  replaceProjectSettingsRecord(session, serializeProjectSettings(settings));
  const resource = readProjectSettingsFromSession(session);
  return {
    resource,
    resourceKeys: [studioProjectSettingsResourceKey()],
  };
}

export function readProjectSettingsFromSession(
  session: DatabaseSession
): ProjectSettingsResource {
  const row = readRequiredProjectSettingsRecord(session);
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return {
    project: { name: project.projectName, id: project.id },
    settings: parseStoredProjectSettings(row.document),
  };
}

function readRequiredProjectSettingsRecord(session: DatabaseSession) {
  const row = readProjectSettingsRecord(session);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_SETTINGS001',
      'The selected Project database has no Project Settings singleton.',
      {
        suggestion:
          'Migrate the selected Project through the supported Renku migration workflow.',
      }
    );
  }
  return row;
}
