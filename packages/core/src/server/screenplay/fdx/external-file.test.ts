import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFdxSourceBytes, MAX_FDX_SOURCE_BYTES } from './source.js';

// Exercise real bounded I/O; spies introduce an exporter write at the read boundary.
describe('FDX bounded file envelope', () => {
  afterEach(() => vi.restoreAllMocks());
  function source() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'renku-fdx-envelope-'));
    const file = path.join(directory, 'script.fdx');
    fs.writeFileSync(file, '<FinalDraft/>');
    return file;
  }

  it('enforces the byte cap when an export grows after stat', () => {
    const file = source();
    const read = fs.readSync;
    let bytesRequested = 0;
    vi.spyOn(fs, 'readSync').mockImplementation(((descriptor: number, buffer: Buffer, offset: number, length: number, position: number | null) => {
      bytesRequested += length;
      fs.truncateSync(file, MAX_FDX_SOURCE_BYTES + 2000);
      return read(descriptor, buffer, offset, length, position);
    }) as typeof fs.readSync);
    expect(() => readFdxSourceBytes(file)).toThrow(expect.objectContaining({ code: 'SCREENPLAY_FDX_SOURCE_TOO_LARGE' }));
    expect(bytesRequested).toBe(MAX_FDX_SOURCE_BYTES + 1);
  });

  it('rejects a same-size edit during a read', () => {
    const file = source();
    const read = fs.readSync;
    let changed = false;
    vi.spyOn(fs, 'readSync').mockImplementation(((descriptor: number, buffer: Buffer, offset: number, length: number, position: number | null) => {
      const result = read(descriptor, buffer, offset, length, position);
      if (!changed) { changed = true; fs.writeFileSync(file, '<OtherDraft/>'); fs.utimesSync(file, new Date(), new Date('2099-01-01')); }
      return result;
    }) as typeof fs.readSync);
    expect(() => readFdxSourceBytes(file)).toThrow(expect.objectContaining({ code: 'SCREENPLAY_FDX_SOURCE_CHANGED' }));
  });

  it('reports inaccessible files distinctly from absence', () => {
    const file = source();
    fs.chmodSync(file, 0);
    try {
      expect(() => readFdxSourceBytes(file)).toThrow(expect.objectContaining({ code: 'SCREENPLAY_FDX_SOURCE_UNREADABLE' }));
    } finally {
      fs.chmodSync(file, 0o600);
    }
    expect(() => readFdxSourceBytes(`${file}.missing`)).toThrow(expect.objectContaining({ code: 'SCREENPLAY_FDX_SOURCE_NOT_FOUND' }));
  });
});
