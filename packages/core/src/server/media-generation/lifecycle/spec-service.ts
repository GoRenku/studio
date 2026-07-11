import type { MediaGenerationSpecRecord } from '../../../client/index.js';
import {
  requireMediaGenerationSpec,
} from '../../database/access/media-generation.js';
import type {
  ReadMediaGenerationSpecInput,
} from '../../project-data-service-contracts.js';
import {
  requireMediaGenerationPurposeDefinition,
} from './purpose-lifecycle-registry.js';
import type {
  CreateMediaGenerationSpecInput,
  ListMediaGenerationSpecsInput,
  PrepareDraftMediaGenerationSpecInput,
  UpdateMediaGenerationSpecInput,
  ValidateMediaGenerationSpecInput,
} from './purpose-definition.js';
import { assertRootDependenciesResolved } from './dependency-service.js';
import { withMediaGenerationProjectSession } from './project-session.js';

export async function validateMediaGenerationSpec(
  input: ValidateMediaGenerationSpecInput
) {
  return requireMediaGenerationPurposeDefinition(input.spec.purpose).validateSpec(
    input
  );
}

export async function createMediaGenerationSpec(
  input: CreateMediaGenerationSpecInput
) {
  const definition = requireMediaGenerationPurposeDefinition(input.spec.purpose);
  if (definition.declareDependencies) {
    await assertRootDependenciesResolved(input);
  }
  return definition.createSpec(input);
}

export async function updateMediaGenerationSpec(
  input: UpdateMediaGenerationSpecInput
) {
  const definition = requireMediaGenerationPurposeDefinition(input.spec.purpose);
  if (definition.declareDependencies) {
    await assertRootDependenciesResolved(input);
  }
  return definition.updateSpec(input);
}

export async function readMediaGenerationSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  return withMediaGenerationProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listMediaGenerationSpecs(
  input: ListMediaGenerationSpecsInput
) {
  return requireMediaGenerationPurposeDefinition(input.purpose).listSpecs(input);
}

export async function prepareMediaGenerationSpec(
  input: ReadMediaGenerationSpecInput
) {
  const specRecord = await readMediaGenerationSpec(input);
  return requireMediaGenerationPurposeDefinition(specRecord.purpose).prepareSpec(
    input
  );
}

export async function prepareDraftMediaGenerationSpec(
  input: PrepareDraftMediaGenerationSpecInput
) {
  return requireMediaGenerationPurposeDefinition(
    input.spec.purpose
  ).prepareDraftSpec(input);
}
