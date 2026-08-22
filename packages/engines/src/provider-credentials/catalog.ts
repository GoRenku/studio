export type ProviderCredentialId = 'fal-ai' | 'elevenlabs' | 'world-labs';

export interface ProviderCredentialDescriptor {
  provider: ProviderCredentialId;
  label: string;
  environmentVariable: string;
}

const PROVIDER_CREDENTIAL_DESCRIPTORS = [
  {
    provider: 'fal-ai',
    label: 'fal.ai',
    environmentVariable: 'FAL_KEY',
  },
  {
    provider: 'elevenlabs',
    label: 'ElevenLabs',
    environmentVariable: 'ELEVENLABS_API_KEY',
  },
  {
    provider: 'world-labs',
    label: 'World Labs',
    environmentVariable: 'WLT_API_KEY',
  },
] as const satisfies readonly ProviderCredentialDescriptor[];

export function listProviderCredentialDescriptors(): readonly ProviderCredentialDescriptor[] {
  return PROVIDER_CREDENTIAL_DESCRIPTORS;
}

export function findProviderCredentialDescriptor(
  provider: string
): ProviderCredentialDescriptor | undefined {
  return PROVIDER_CREDENTIAL_DESCRIPTORS.find(
    (descriptor) => descriptor.provider === provider
  );
}
