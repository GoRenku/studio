import type { JsonValue } from '../../../media/contracts.js';
import { EngineError } from '../../../shared/errors.js';

export function requireString(value: JsonValue | undefined, field: string, model: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EngineError('ENGINE_REQUEST_INVALID', `ElevenLabs "${field}" is required.`, {
      provider: 'elevenlabs', model,
    });
  }
}
