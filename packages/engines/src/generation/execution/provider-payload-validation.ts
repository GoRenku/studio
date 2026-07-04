import {
  loadModelSchemaFile,
  lookupModel,
  type LoadedModelCatalog,
} from '../../model-catalog.js';
import { validatePayload } from '../../sdk/schema-validator.js';
import { resolveSchemaRefs } from '../../sdk/unified/schema-file.js';
import { resolveBundledModelCatalogDir } from '../catalog/model-discovery.js';

export async function validateGenerationProviderPayload(input: {
  catalog: LoadedModelCatalog;
  provider: string;
  model: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const model = lookupModel(input.catalog, input.provider, input.model);
  if (!model) {
    throw new Error(
      `Unknown generation model: ${input.provider}/${input.model}.`
    );
  }
  const schemaFile = await loadModelSchemaFile(
    resolveBundledModelCatalogDir(),
    input.catalog,
    input.provider,
    input.model
  );
  if (!schemaFile) {
    return;
  }
  validatePayload(
    JSON.stringify(resolveSchemaRefs(schemaFile.inputSchema, schemaFile.definitions)),
    input.payload,
    `${input.provider}/${input.model} input`
  );
}
