export type ProviderCredentialId =
  | 'fal-ai'
  | 'replicate'
  | 'wavespeed-ai'
  | 'elevenlabs'
  | 'world-labs';

export interface ProviderCredentialDescriptor {
  provider: ProviderCredentialId;
  label: string;
  environmentVariable: string;
}

const PROVIDER_CREDENTIAL_DESCRIPTORS = [
  { provider: 'fal-ai', label: 'Fal.ai', environmentVariable: 'FAL_KEY' },
  { provider: 'replicate', label: 'Replicate', environmentVariable: 'REPLICATE_API_TOKEN' },
  { provider: 'wavespeed-ai', label: 'WaveSpeed', environmentVariable: 'WAVESPEED_API_KEY' },
  { provider: 'elevenlabs', label: 'ElevenLabs', environmentVariable: 'ELEVENLABS_API_KEY' },
  { provider: 'world-labs', label: 'World Labs', environmentVariable: 'WLT_API_KEY' },
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
