import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  readProviderCredentials,
  updateProviderCredentials,
} from './service.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true })
    )
  );
});

describe('provider credential service', () => {
  it('returns the exact sanitized Settings resource', async () => {
    const homeDir = await createHome();
    await writeCredentialFile(
      homeDir,
      'FAL_KEY="saved-fal-secret"\nELEVENLABS_API_KEY="saved-elevenlabs-secret"\n'
    );

    const resource = await readProviderCredentials({ homeDir });

    expect(resource).toEqual({
      providers: [
        {
          provider: 'fal-ai',
          label: 'fal.ai',
          configured: true,
        },
        {
          provider: 'elevenlabs',
          label: 'ElevenLabs',
          configured: true,
        },
        {
          provider: 'world-labs',
          label: 'World Labs',
          configured: false,
        },
      ],
    });
    expect(JSON.stringify(resource)).not.toContain('saved-fal-secret');
  });

  it('applies one validated multi-provider update and returns post-write status', async () => {
    const homeDir = await createHome();
    await writeCredentialFile(
      homeDir,
      '# Keep this comment\nUNMANAGED=keep\nWLT_API_KEY=old-value\n'
    );

    const resource = await updateProviderCredentials({
      homeDir,
      update: {
        changes: [
          { provider: 'fal-ai', value: '  fal-value  ' },
          {
            provider: 'elevenlabs',
            value: 'elevenlabs-value',
          },
        ],
      },
    });

    expect(resource.providers.map((provider) => provider.configured)).toEqual([
      true,
      true,
      true,
    ]);
    const credentialPath = resolveCredentialPath(homeDir);
    const contents = await fs.readFile(credentialPath, 'utf8');
    expect(contents).toContain('# Keep this comment\n');
    expect(contents).toContain('UNMANAGED=keep\n');
    expect(contents).toContain('FAL_KEY="fal-value"\n');
    expect(contents).toContain('WLT_API_KEY="old-value"\n');
    expect((await fs.stat(credentialPath)).mode & 0o777).toBe(0o600);
  });

  it.each([
    {
      name: 'empty update',
      changes: [],
      issuePath: ['changes'],
    },
    {
      name: 'unknown provider',
      changes: [
        { provider: 'unknown-provider', value: 'value' },
      ],
      issuePath: ['changes', '0', 'provider'],
    },
    {
      name: 'blank key',
      changes: [{ provider: 'fal-ai', value: '   ' }],
      issuePath: ['changes', '0', 'value'],
    },
    {
      name: 'multiline key',
      changes: [{ provider: 'fal-ai', value: 'one\ntwo' }],
      issuePath: ['changes', '0', 'value'],
    },
    {
      name: 'carriage-return key',
      changes: [{ provider: 'fal-ai', value: 'one\rtwo' }],
      issuePath: ['changes', '0', 'value'],
    },
    {
      name: 'NUL key',
      changes: [{ provider: 'fal-ai', value: 'one\0two' }],
      issuePath: ['changes', '0', 'value'],
    },
    {
      name: 'duplicate provider',
      changes: [
        { provider: 'fal-ai', value: 'one' },
        { provider: 'fal-ai', value: 'two' },
      ],
      issuePath: ['changes', '1', 'provider'],
    },
  ])('rejects $name before writing', async ({ changes, issuePath }) => {
    const homeDir = await createHome();
    await writeCredentialFile(homeDir, 'FAL_KEY="original-value"\n');

    let caught: unknown;
    try {
      await updateProviderCredentials({
        homeDir,
        update: { changes } as never,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: 'PROVIDER_CREDENTIALS001' });
    expect(
      (caught as { issues: Array<{ location: { path: string[] } }> }).issues.some(
        (issue) => JSON.stringify(issue.location.path) === JSON.stringify(issuePath)
      )
    ).toBe(true);
    expect(await fs.readFile(resolveCredentialPath(homeDir), 'utf8')).toBe(
      'FAL_KEY="original-value"\n'
    );
  });

  it('maps an invalid credential path to a structured read error', async () => {
    const homeDir = await createHome();
    await fs.mkdir(resolveCredentialPath(homeDir), { recursive: true });

    await expect(readProviderCredentials({ homeDir })).rejects.toMatchObject({
      code: 'PROVIDER_CREDENTIALS002',
    });
  });

  it('replaces the saved key even when the process exports a different value', async () => {
    const homeDir = await createHome();
    await writeCredentialFile(homeDir, 'FAL_KEY="original-value"\n');
    const originalExport = process.env.FAL_KEY;
    process.env.FAL_KEY = 'environment-value';
    try {
      const resource = await updateProviderCredentials({
        homeDir,
        update: {
          changes: [{ provider: 'fal-ai', value: 'replacement' }],
        },
      });
      expect(resource.providers[0]).toMatchObject({ configured: true });
      expect(await fs.readFile(resolveCredentialPath(homeDir), 'utf8')).toContain(
        'FAL_KEY="replacement"'
      );
    } finally {
      if (originalExport === undefined) {
        delete process.env.FAL_KEY;
      } else {
        process.env.FAL_KEY = originalExport;
      }
    }
  });
});

async function createHome(): Promise<string> {
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'renku-core-provider-credentials-')
  );
  temporaryRoots.push(homeDir);
  return homeDir;
}

async function writeCredentialFile(
  homeDir: string,
  contents: string
): Promise<void> {
  const credentialPath = resolveCredentialPath(homeDir);
  await fs.mkdir(path.dirname(credentialPath), { recursive: true });
  await fs.writeFile(credentialPath, contents, 'utf8');
}

function resolveCredentialPath(homeDir: string): string {
  return path.join(homeDir, '.config', 'renku', '.env');
}
