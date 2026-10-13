import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { isGenerationLane } from '../../client/generation-lanes.js';
import type {
  GenerationLaneSettings,
  ProjectSettingsMutationReport,
  UpdateGenerationLaneSettingsChange,
} from '../../client/project-settings.js';
import { replaceProjectSettingsRecord } from '../database/access/project-settings.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioProjectSettingsResourceKey } from '../studio-coordination/resource-keys.js';
import { serializeProjectSettings } from './document.js';
import { readProjectSettingsFromSession } from './service.js';

const LANE_FIELDS = [
  'provider',
  'model',
  'chooseRouteBeforeGenerating',
  'askBeforeGenerating',
] as const;

/**
 * Focused writer for the per-lane fields the CLI, the Route Chooser and the
 * generation review own. Changing the provider without naming a model clears
 * the model, because a model family is only meaningful for its provider.
 */
export async function updateGenerationLaneSettings(
  input: ReadProjectInput & UpdateGenerationLaneSettingsChange
): Promise<ProjectSettingsMutationReport> {
  assertLaneChange(input);
  const { session } = await openProjectSession(input);
  const current = readProjectSettingsFromSession(session).settings;
  const lane = current.generation[input.lane];
  const next: GenerationLaneSettings = {
    ...lane,
    ...definedLaneFields(input),
  };
  if (input.provider !== undefined && input.provider !== lane.provider && input.model === undefined) {
    next.model = null;
  }
  const settings = {
    ...current,
    generation: { ...current.generation, [input.lane]: next },
  };
  replaceProjectSettingsRecord(session, serializeProjectSettings(settings));
  return {
    resource: readProjectSettingsFromSession(session),
    resourceKeys: [studioProjectSettingsResourceKey()],
  };
}

function assertLaneChange(input: UpdateGenerationLaneSettingsChange): void {
  if (!isGenerationLane(input.lane)) {
    throw new ProjectDataError(
      'PROJECT_SETTINGS003',
      `Unknown generation lane: ${String(input.lane)}.`,
      {
        issues: [createDiagnosticError(
          'PROJECT_SETTINGS003',
          'Choose image, imageEdit, video or audio.',
          { path: ['lane'], context: 'Generation lane settings' }
        )],
      }
    );
  }
  if (Object.keys(definedLaneFields(input)).length === 0) {
    throw new ProjectDataError(
      'PROJECT_SETTINGS003',
      'A generation lane change must name at least one field.',
      {
        suggestion: 'Provide provider, model, chooseRouteBeforeGenerating or askBeforeGenerating.',
      }
    );
  }
}

function definedLaneFields(
  input: UpdateGenerationLaneSettingsChange
): Partial<GenerationLaneSettings> {
  return Object.fromEntries(
    LANE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [field, input[field]])
  );
}
