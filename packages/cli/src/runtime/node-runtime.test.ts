import { mkdtempSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  isRenkuCliEntrypoint,
  isSupportedNodeVersion,
} from './node-runtime.js';

describe('Renku Node runtime', () => {
  it('accepts patched versions in the supported Node release lines', () => {
    expect(isSupportedNodeVersion('22.23.4')).toBe(true);
    expect(isSupportedNodeVersion('22.23.5')).toBe(true);
    expect(isSupportedNodeVersion('22.24.0')).toBe(true);
    expect(isSupportedNodeVersion('24.22.1')).toBe(true);
    expect(isSupportedNodeVersion('24.22.2')).toBe(true);
    expect(isSupportedNodeVersion('24.23.0')).toBe(true);
    expect(isSupportedNodeVersion()).toBe(true);
  });

  it('rejects unpatched versions and unsupported Node release lines', () => {
    expect(isSupportedNodeVersion('22.23.3')).toBe(false);
    expect(isSupportedNodeVersion('22.22.99')).toBe(false);
    expect(isSupportedNodeVersion('24.22.0')).toBe(false);
    expect(isSupportedNodeVersion('24.21.99')).toBe(false);
    expect(isSupportedNodeVersion('20.19.0')).toBe(false);
    expect(isSupportedNodeVersion('25.0.0')).toBe(false);
    expect(isSupportedNodeVersion('26.12.1')).toBe(false);
    expect(isSupportedNodeVersion('24.22')).toBe(false);
  });

  it('recognizes the built entrypoint using platform path semantics', () => {
    const runtimeFile = fileURLToPath(import.meta.url);
    const entrypoint = path.resolve(path.dirname(runtimeFile), '..', 'cli.js');
    expect(isRenkuCliEntrypoint(entrypoint)).toBe(true);
  });

  it('recognizes an entrypoint reached through an aliased parent path', () => {
    const runtimeFile = fileURLToPath(import.meta.url);
    const entrypointDirectory = path.resolve(path.dirname(runtimeFile), '..');
    const fixture = mkdtempSync(path.join(os.tmpdir(), 'renku-entrypoint-'));
    const aliasedDirectory = path.join(fixture, 'aliased-src');
    symlinkSync(entrypointDirectory, aliasedDirectory, 'dir');

    expect(isRenkuCliEntrypoint(path.join(aliasedDirectory, 'cli.js'))).toBe(true);
  });
});
