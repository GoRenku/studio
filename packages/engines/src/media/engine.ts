import type {
  MediaEngine,
  MediaProvider,
} from './contracts.js';
import { EngineError } from '../shared/errors.js';

export function createMediaEngine(providers: Iterable<MediaProvider>): MediaEngine {
  const registry = new Map<string, MediaProvider>();
  for (const provider of providers) {
    if (registry.has(provider.id)) {
      throw new EngineError(
        'ENGINE_REQUEST_INVALID',
        `Media provider id "${provider.id}" is registered more than once.`,
        { provider: provider.id },
      );
    }
    registry.set(provider.id, provider);
  }

  return {
    readInputSchema(providerId, model, context) {
      const provider = requireProvider(registry, providerId, model);
      if (!provider.readInputSchema) {
        throw new EngineError(
          'ENGINE_INPUT_SCHEMA_UNAVAILABLE',
          `Provider "${providerId}" does not expose a live input schema.`,
          { provider: providerId, model },
        );
      }
      return provider.readInputSchema(model, context);
    },
    validate(providerId, request, context) {
      return requireProvider(registry, providerId, request.model).validate(request, context);
    },
    execute(providerId, request, context) {
      return requireProvider(registry, providerId, request.model).execute(request, context);
    },
    recover(providerId, request, context) {
      const provider = requireProvider(registry, providerId, request.model);
      if (!provider.recover) {
        throw new EngineError(
          'ENGINE_RECOVERY_UNSUPPORTED',
          `Provider "${providerId}" does not support recovery.`,
          { provider: providerId, model: request.model, requestId: request.requestId },
        );
      }
      return provider.recover(request, context);
    },
  } satisfies MediaEngine;
}

function requireProvider(
  registry: ReadonlyMap<string, MediaProvider>,
  providerId: string,
  model: string,
): MediaProvider {
  const provider = registry.get(providerId);
  if (!provider) {
    throw new EngineError(
      'ENGINE_PROVIDER_UNSUPPORTED',
      `Media provider "${providerId}" is not registered.`,
      { provider: providerId, model },
    );
  }
  return provider;
}
