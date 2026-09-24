import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readProviderCredentials } from '@gorenku/studio-core/server';
import { runCredentialsCommand } from './credentials-command.js';

vi.mock('@gorenku/studio-core/server', () => ({
  readProviderCredentials: vi.fn(),
}));

describe('credentials status command', () => {
  const resource = {
    providers: [
      { provider: 'fal-ai', label: 'Fal.ai', configured: true },
      { provider: 'pika', label: 'Pika', configured: false },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readProviderCredentials).mockResolvedValue(resource);
  });

  it('prints only the sanitized Core resource without a Project', async () => {
    const output: string[] = [];
    expect(await runCredentialsCommand({
      input: ['status'], json: true, homeDir: '/tmp/credential-home',
      io: { stdout: { log: (value) => output.push(value) }, stderr: { error: vi.fn() } },
    })).toBe(0);
    expect(readProviderCredentials).toHaveBeenCalledWith({ homeDir: '/tmp/credential-home' });
    expect(JSON.parse(output[0]!)).toEqual(resource);
  });

  it('succeeds when no keys are configured', async () => {
    vi.mocked(readProviderCredentials).mockResolvedValue({
      providers: resource.providers.map((provider) => ({ ...provider, configured: false })),
    });
    const output: string[] = [];
    expect(await runCredentialsCommand({
      input: ['status'], json: false,
      io: { stdout: { log: (value) => output.push(value) }, stderr: { error: vi.fn() } },
    })).toBe(0);
    expect(output).toEqual(['Fal.ai: not configured', 'Pika: not configured']);
  });

  it('preserves the Core read diagnostic', async () => {
    vi.mocked(readProviderCredentials).mockRejectedValue({ code: 'PROVIDER_CREDENTIALS002' });
    await expect(runCredentialsCommand({
      input: ['status'], json: true,
      io: { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } },
    })).rejects.toMatchObject({ code: 'PROVIDER_CREDENTIALS002' });
  });
});
