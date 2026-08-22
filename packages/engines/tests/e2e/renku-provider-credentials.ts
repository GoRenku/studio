import type { SecretResolver } from '../../src/types.js';

const CORE_SERVER_ENTRYPOINT = new URL(
  '../../../core/dist/server/index.js',
  import.meta.url
).href;

interface CoreProviderCredentialModule {
  createRenkuProviderSecretResolver(): SecretResolver;
}

export async function requireRenkuProviderSecretResolver(
  credentialName: string
): Promise<SecretResolver> {
  const core = (await import(
    CORE_SERVER_ENTRYPOINT
  )) as CoreProviderCredentialModule;
  const secretResolver = core.createRenkuProviderSecretResolver();
  const credential = await secretResolver.getSecret(credentialName);
  if (!credential) {
    throw new Error(
      `${credentialName} is not configured in the Renku provider credential file.`
    );
  }
  return secretResolver;
}
