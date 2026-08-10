import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  isRenkuCliEntrypoint,
  isSupportedNodeVersion,
} from './node-runtime.js';

describe('Renku Node runtime', () => {
  it('accepts the supported Node release lines', () => {
    expect(isSupportedNodeVersion('22.12.0')).toBe(true);
    expect(isSupportedNodeVersion('22.21.1')).toBe(true);
    expect(isSupportedNodeVersion('24.0.0')).toBe(true);
    expect(isSupportedNodeVersion('20.19.0')).toBe(false);
    expect(isSupportedNodeVersion('22.11.0')).toBe(false);
    expect(isSupportedNodeVersion('25.0.0')).toBe(false);
  });

  it('recognizes the built entrypoint using platform path semantics', () => {
    const runtimeFile = fileURLToPath(import.meta.url);
    const entrypoint = path.resolve(path.dirname(runtimeFile), '..', 'cli.js');
    expect(isRenkuCliEntrypoint(entrypoint)).toBe(true);
  });
});
