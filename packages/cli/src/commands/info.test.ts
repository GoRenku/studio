import { describe, expect, it } from 'vitest';
import { getRenkuCliInfo } from './about-command.js';

describe('studio-cli scaffold', () => {
  it('reports the Renku CLI and core packages', () => {
    expect(getRenkuCliInfo()).toEqual({
      cli: '@gorenku/studio-cli',
      binary: 'renku',
      version: '0.1.0',
      core: {
        packageName: '@gorenku/studio-core',
        purpose: 'renku-studio-domain',
      },
    });
  });
});
