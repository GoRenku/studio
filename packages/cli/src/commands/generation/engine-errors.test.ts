import { describe, expect, it } from 'vitest';
import { resolveRenkuStateDir } from '@gorenku/studio-core/server';
import { EngineError } from '@gorenku/studio-engines';
import { throwEngineError } from './engine-errors.js';

describe('engine error translation', () => {
  it('names the state folder and the Codex permission grant when the provider cache cannot be written', () => {
    const error = new EngineError('ENGINE_METADATA_CACHE_UNWRITABLE', 'Renku cannot save provider data in /state/cache/provider-metadata: writing there is not permitted.', { provider: 'atlas' });
    const stateDir = resolveRenkuStateDir();
    expect(() => throwEngineError(error)).toThrowError(expect.objectContaining({
      code: 'ENGINE_METADATA_CACHE_UNWRITABLE',
      suggestion: `Renku needs write access to its state folder ${stateDir}. In a Codex permission profile, add "${stateDir}" = "write" under [permissions.<profile>.filesystem] in ~/.codex/config.toml, then start a new Codex thread.`,
    }));
  });

  it('suggests a retry only for retryable errors', () => {
    expect(() => throwEngineError(new EngineError('ENGINE_PROVIDER_UNAVAILABLE', 'Down.', { provider: 'atlas', retryable: true }))).toThrowError(expect.objectContaining({ suggestion: 'Retry after the provider becomes available.' }));
    expect(() => throwEngineError(new EngineError('ENGINE_REQUEST_REJECTED', 'No.', { provider: 'atlas' }))).toThrowError(expect.objectContaining({ suggestion: undefined }));
  });
});
