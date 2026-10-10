import type {
  JsonValue,
  MediaProvider,
  ProviderContext,
  ProviderExecutionResult,
  ProviderRequest,
} from '../../media/contracts.js';
import { findLocalMediaFiles } from '../../media/local-files.js';
import { EngineError } from '../../shared/errors.js';
import { resolveElevenLabsOperation } from './operations/registry.js';

export function createElevenLabsMediaProvider(): MediaProvider {
  return {
    id: 'elevenlabs',
    async readInputSchema(model, context) {
      requireCredential(model, context);
      const { operation } = resolveElevenLabsOperation(model);
      if (operation.inputSchema === undefined) {
        throw new EngineError(
          'ENGINE_INPUT_SCHEMA_UNAVAILABLE',
          `ElevenLabs does not expose an input schema for ${model}.`,
          { provider: 'elevenlabs', model },
        );
      }
      return operation.inputSchema;
    },
    async validate(request, context) {
      requireCredential(request.model, context);
      validateRequest(request);
    },
    async execute(request, context): Promise<ProviderExecutionResult> {
      requireCredential(request.model, context);
      const { input, operation, target } = validateRequest(request);
      return operation.execute(input, target, context);
    },
  };
}

function validateRequest(request: ProviderRequest) {
  if (findLocalMediaFiles(request.input).length > 0) {
    throw new EngineError(
      'ENGINE_LOCAL_MEDIA_INVALID',
      'ElevenLabs generation requests do not accept local-media markers.',
      { provider: 'elevenlabs', model: request.model },
    );
  }
  const input = asObject(request.input, request.model);
  const { operation, target } = resolveElevenLabsOperation(request.model);
  operation.validate(input, target);
  return { input, operation, target };
}

function asObject(value: JsonValue, model: string): Record<string, JsonValue> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EngineError('ENGINE_REQUEST_INVALID', 'ElevenLabs input must be an object.', {
      provider: 'elevenlabs', model,
    });
  }
  return value;
}

function requireCredential(model: string, context: ProviderContext): void {
  if (!context.credential) {
    throw new EngineError('ENGINE_AUTHENTICATION_FAILED', 'ElevenLabs credential is required.', {
      provider: 'elevenlabs', model,
    });
  }
}
