import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  type ShotVideoTakeOutputGenerationSpec,
} from '../../../../client/index.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import { buildShotVideoTakeContext } from '../../purposes/shot-video-take/authoring/context.js';
import { declareShotVideoTakeDependencies } from '../../purposes/shot-video-take/planning/dependency-inventory.js';
import { runShotVideoTakeSpec } from '../../purposes/shot-video-take/runs/generation-runs.js';
import {
  createShotVideoTakeSpec,
  buildShotVideoTakeGenerationPreview,
  listShotVideoTakeSpecs,
  prepareShotVideoTakeDraftSpec,
  prepareShotVideoTakeSpec,
  updateShotVideoTakeSpec,
  validateShotVideoTakeSpec,
} from '../../purposes/shot-video-take/specs/final-specs.js';
import {
  updateShotVideoTakeGenerationPreview,
} from '../../purposes/shot-video-take/specs/generation-preview.js';
import { listShotVideoTakeModels } from '../../purposes/shot-video-take/specs/model-list.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toShotInput, toShotModelInput } from '../purpose-targets.js';

export const shotVideoTakePurposeDefinition = {
  purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  mediaKind: 'video',
  targetKind: 'sceneShotVideoTake',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => buildShotVideoTakeContext(toShotInput(input)),
  listModels: (input) => listShotVideoTakeModels(toShotModelInput(input)),
  validateSpec: (input) => validateShotVideoTakeSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ShotVideoTakeOutputGenerationSpec,
  }),
  createSpec: (input) => createShotVideoTakeSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ShotVideoTakeOutputGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => updateShotVideoTakeSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as ShotVideoTakeOutputGenerationSpec,
  }),
  listSpecs: (input) => listShotVideoTakeSpecs(toShotInput(input)),
  prepareSpec: prepareShotVideoTakeSpec,
  preview: {
    build: buildShotVideoTakeGenerationPreview,
    update: updateShotVideoTakeGenerationPreview,
  },
  prepareDraftSpec: (input) => prepareShotVideoTakeDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ShotVideoTakeOutputGenerationSpec,
  }),
  declareDependencies: declareShotVideoTakeDependencies,
  runSpec: runShotVideoTakeSpec,
} satisfies MediaGenerationPurposeDefinition;
