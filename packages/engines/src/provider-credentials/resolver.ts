import type { SecretResolver } from '../types.js';
import {
  readSavedProviderCredential,
  type ProviderCredentialStoreOptions,
} from './env-file.js';

export function createRenkuProviderSecretResolver(
  options: ProviderCredentialStoreOptions = {}
): SecretResolver {
  return {
    async getSecret(key: string): Promise<string | null> {
      return readSavedProviderCredential(key, options);
    },
  };
}
