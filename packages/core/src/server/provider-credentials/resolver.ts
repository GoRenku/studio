import type { SecretResolver } from '@gorenku/studio-engines';
import {
  readSavedProviderCredential,
  type ProviderCredentialStoreOptions,
} from './store.js';

export function createRenkuProviderSecretResolver(
  options: ProviderCredentialStoreOptions = {}
): SecretResolver {
  return {
    async getSecret(key: string): Promise<string | null> {
      return readSavedProviderCredential(key, options);
    },
  };
}
