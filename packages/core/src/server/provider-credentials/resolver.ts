import {
  findProviderCredentialDescriptor,
  type ProviderCredentialId,
} from './catalog.js';
import {
  readSavedProviderCredential,
  type ProviderCredentialStoreOptions,
} from './store.js';

export async function resolveRenkuProviderCredential(
  provider: ProviderCredentialId,
  options: ProviderCredentialStoreOptions = {}
): Promise<string | null> {
  const descriptor = findProviderCredentialDescriptor(provider);
  return descriptor
    ? readSavedProviderCredential(descriptor.environmentVariable, options)
    : null;
}
