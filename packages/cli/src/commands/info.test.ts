import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json' with { type: 'json' };
import { getRenkuCliInfo } from './about-command.js';

describe('studio-cli scaffold', () => {
  it('reports the Renku CLI and core packages', () => {
    expect(getRenkuCliInfo()).toEqual({
      cli: '@gorenku/studio-cli',
      binary: 'renku',
      version: packageJson.version,
      core: {
        packageName: '@gorenku/studio-core',
        purpose: 'renku-studio-domain',
      },
    });
  });
});
