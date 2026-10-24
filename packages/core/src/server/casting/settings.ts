import type { CastingSettings, CastingSettingsReport } from '../../client/casting/model.js';
import { readProjectRecord } from '../database/access/project.js';
import { replaceProjectSettingsRecord } from '../database/access/project-settings.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { withProject } from '../project-operation.js';
import { serializeProjectSettings } from '../project-settings/document.js';
import { readProjectSettingsFromSession } from '../project-settings/service.js';
import { studioProjectSettingsResourceKey } from '../studio-coordination/resource-keys.js';
import type { CastingProjectInput } from '../project-data-service-contracts.js';
import { assertCastingSettingsShape } from './documents.js';

export async function showCastingSettings(input: CastingProjectInput): Promise<CastingSettingsReport> {
  return withProject(input, ({ session }) => settingsReport(session));
}

/** Replaces the Project's casting defaults, written by the round panel or `renku settings casting set`. */
export async function setCastingSettings(
  input: CastingProjectInput & { casting: unknown; filePath?: string }
): Promise<CastingSettingsReport> {
  return withProject(input, ({ session }) => {
    assertCastingSettingsShape(input.casting, input.filePath);
    const casting: CastingSettings = input.casting;
    const current = readProjectSettingsFromSession(session).settings;
    replaceProjectSettingsRecord(session, serializeProjectSettings({ ...current, casting }));
    return settingsReport(session);
  });
}

function settingsReport(session: DatabaseSession): CastingSettingsReport {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError('PROJECT_DATA021', 'Project database has no project row.');
  }
  return {
    valid: true,
    warnings: [],
    project: { id: project.id, projectName: project.projectName },
    resourceKeys: [studioProjectSettingsResourceKey()],
    casting: readProjectSettingsFromSession(session).settings.casting,
  };
}
