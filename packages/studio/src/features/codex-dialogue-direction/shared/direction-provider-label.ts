const PROVIDER_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  'fal-ai': 'Fal.ai',
  'wavespeed-ai': 'WaveSpeed',
  pika: 'Pika',
};

/** The provider name shown in a Generate disclosure and approval sentence. */
export function directionProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}
