import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listProviderCredentialDescriptors } from '@gorenku/studio-engines';
import { createRenkuProviderSecretResolver } from './resolver.js';
import {
  readProviderCredentialStore,
  resolveProviderCredentialFilePath,
  writeProviderCredentials,
} from './store.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true })
    )
  );
});

describe('provider credential store', () => {
  it('projects sanitized configured status from the Core-owned credential file', async () => {
    const options = await createOptions();
    await writeEnvironmentFile(
      options.homeDir,
      'FAL_KEY="saved-fal-key"\nELEVENLABS_API_KEY="saved-elevenlabs-key"\n'
    );

    await expect(readProviderCredentialStore(options)).resolves.toEqual({
      providers: [
        { provider: 'fal-ai', configured: true },
        { provider: 'elevenlabs', configured: true },
        { provider: 'world-labs', configured: false },
      ],
    });
  });

  it('ignores exported values and resolves only the Renku-saved key', async () => {
    const options = await createOptions();
    await writeEnvironmentFile(options.homeDir, 'FAL_KEY="saved-fal-key"\n');
    const originalValue = process.env.FAL_KEY;
    process.env.FAL_KEY = 'exported-fal-key';
    try {
      const resolver = createRenkuProviderSecretResolver(options);
      await expect(resolver.getSecret('FAL_KEY')).resolves.toBe('saved-fal-key');
    } finally {
      if (originalValue === undefined) {
        delete process.env.FAL_KEY;
      } else {
        process.env.FAL_KEY = originalValue;
      }
    }
  });

  it('preserves unmanaged content and writes owner-only managed values', async () => {
    const options = await createOptions();
    await writeEnvironmentFile(
      options.homeDir,
      [
        '# Provider configuration',
        'UNMANAGED_VALUE=keep-me',
        '',
        'FAL_KEY=old-value',
        'FAL_KEY=duplicate-value',
        'WLT_API_KEY=keep-world-labs',
        '',
      ].join('\n')
    );

    await writeProviderCredentials(
      [
        { provider: 'fal-ai', value: 'new-fal-value' },
        { provider: 'elevenlabs', value: 'new-elevenlabs-value' },
      ],
      options
    );

    const filePath = resolveProviderCredentialFilePath(options);
    const contents = await fs.readFile(filePath, 'utf8');
    expect(contents).toContain('# Provider configuration\n');
    expect(contents).toContain('UNMANAGED_VALUE=keep-me\n');
    expect(contents.match(/FAL_KEY=/g)).toHaveLength(1);
    expect(contents).toContain('FAL_KEY="new-fal-value"\n');
    expect(contents).toContain('ELEVENLABS_API_KEY="new-elevenlabs-value"\n');
    expect(contents).toContain('WLT_API_KEY="keep-world-labs"\n');
    if (process.platform !== 'win32') {
      expect((await fs.stat(filePath)).mode & 0o777).toBe(0o600);
    }
  });

  it('returns replacements on consecutive resolver lookups', async () => {
    const options = await createOptions();
    const resolver = createRenkuProviderSecretResolver(options);

    await writeProviderCredentials(
      [{ provider: 'fal-ai', value: 'first-value' }],
      options
    );
    await expect(resolver.getSecret('FAL_KEY')).resolves.toBe('first-value');

    await writeProviderCredentials(
      [{ provider: 'fal-ai', value: 'second-value' }],
      options
    );
    await expect(resolver.getSecret('FAL_KEY')).resolves.toBe('second-value');
  });

  it('leaves the original file intact when atomic replacement fails', async () => {
    const options = await createOptions();
    await writeEnvironmentFile(
      options.homeDir,
      '# keep this document\nFAL_KEY="original-value"\n'
    );
    const filePath = resolveProviderCredentialFilePath(options);
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(
      new Error('injected rename failure')
    );

    await expect(
      writeProviderCredentials(
        [{ provider: 'fal-ai', value: 'replacement-value' }],
        options
      )
    ).rejects.toMatchObject({ operation: 'write' });

    expect(await fs.readFile(filePath, 'utf8')).toBe(
      '# keep this document\nFAL_KEY="original-value"\n'
    );
    expect(
      (await fs.readdir(path.dirname(filePath))).filter((entry) =>
        entry.endsWith('.tmp')
      )
    ).toEqual([]);
    rename.mockRestore();
  });

  it('resolves unlisted keys without exposing them as Settings providers', async () => {
    const options = await createOptions();
    await writeEnvironmentFile(options.homeDir, 'UNLISTED_PROVIDER_KEY=saved-value\n');
    const resolver = createRenkuProviderSecretResolver(options);

    await expect(resolver.getSecret('UNLISTED_PROVIDER_KEY')).resolves.toBe(
      'saved-value'
    );
    expect(
      listProviderCredentialDescriptors().some(
        (descriptor) => descriptor.environmentVariable === 'UNLISTED_PROVIDER_KEY'
      )
    ).toBe(false);
  });
});

async function createOptions() {
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'renku-provider-credentials-')
  );
  temporaryRoots.push(homeDir);
  return { homeDir };
}

async function writeEnvironmentFile(
  homeDir: string,
  contents: string
): Promise<void> {
  const filePath = resolveProviderCredentialFilePath({ homeDir });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, 'utf8');
}
