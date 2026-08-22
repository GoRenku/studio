import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RenkuConfigError } from './errors.js';
import {
  resolveRecommendedRenkuStorageRootForPlatform,
  resolveRenkuConfigDir,
  resolveRenkuConfigDirForPlatform,
  resolveRenkuConfigPath,
} from './paths.js';

describe('Renku config paths', () => {
  it('keeps explicit test homes isolated under .config/renku', () => {
    const homeDir = path.join(path.parse(process.cwd()).root, 'tmp', 'renku-home');
    expect(resolveRenkuConfigDir({ homeDir })).toBe(
      path.join(homeDir, '.config', 'renku')
    );
    expect(resolveRenkuConfigPath({ homeDir })).toBe(
      path.join(homeDir, '.config', 'renku', 'config.yaml')
    );
  });

  it('keeps the macOS CLI config under .config/renku', () => {
    expect(
      resolveRenkuConfigDirForPlatform({
        platform: 'darwin',
        homeDir: '/Users/alex',
      })
    ).toBe('/Users/alex/.config/renku');
  });

  it('uses native LocalAppData on Windows', () => {
    expect(
      resolveRenkuConfigDirForPlatform({
        platform: 'win32',
        homeDir: 'C:\\Users\\Alex',
        localAppData: 'C:\\Users\\Alex\\AppData\\Local',
      })
    ).toBe('C:\\Users\\Alex\\AppData\\Local\\Renku\\Studio');
  });

  it.each([undefined, '', 'relative\\AppData'])(
    'rejects an unavailable Windows LocalAppData value: %s',
    (localAppData) => {
      expect(() =>
        resolveRenkuConfigDirForPlatform({
          platform: 'win32',
          homeDir: 'C:\\Users\\Alex',
          localAppData,
        })
      ).toThrowError(RenkuConfigError);
      try {
        resolveRenkuConfigDirForPlatform({
          platform: 'win32',
          homeDir: 'C:\\Users\\Alex',
          localAppData,
        });
      } catch (error) {
        expect(error).toMatchObject({ code: 'CONFIG014' });
      }
    }
  );

  it('honors an absolute XDG config home on Linux', () => {
    expect(
      resolveRenkuConfigDirForPlatform({
        platform: 'linux',
        homeDir: '/home/alex',
        xdgConfigHome: '/mnt/config',
      })
    ).toBe('/mnt/config/renku');
  });

  it.each([undefined, '', 'relative-config'])(
    'uses the Unix fallback for an unusable XDG value: %s',
    (xdgConfigHome) => {
      expect(
        resolveRenkuConfigDirForPlatform({
          platform: 'linux',
          homeDir: '/home/alex',
          xdgConfigHome,
        })
      ).toBe('/home/alex/.config/renku');
    }
  );

  it('uses whitespace-free recommended Project Library paths', () => {
    expect(
      resolveRecommendedRenkuStorageRootForPlatform({
        platform: 'darwin',
        homeDir: '/Users/alex',
      })
    ).toBe('/Users/alex/Movies/Renku');
    expect(
      resolveRecommendedRenkuStorageRootForPlatform({
        platform: 'win32',
        homeDir: 'C:\\Users\\Alex',
      })
    ).toBe('C:\\Users\\Alex\\Videos\\Renku');
    expect(
      resolveRecommendedRenkuStorageRootForPlatform({
        platform: 'linux',
        homeDir: '/home/alex',
      })
    ).toBe('/home/alex/Videos/Renku');
  });
});
