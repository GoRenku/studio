import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, expect, it } from 'vitest';
import type { ResolvedProjectAssetFileById } from '@gorenku/studio-core/server';
import { projectAssetFileResponse } from './asset-file-response.js';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-asset-range-'));
const absolutePath = path.join(directory, 'clip.mp4');
fs.writeFileSync(absolutePath, '0123456789');
const resolved: ResolvedProjectAssetFileById = {
  assetId: 'clip', assetMediaKind: 'video', absolutePath,
  file: { id: 'file', role: 'primary', projectRelativePath: 'clip.mp4' as ResolvedProjectAssetFileById['file']['projectRelativePath'], mediaKind: 'video', mimeType: 'video/mp4', sizeBytes: 10, contentHash: null, width: null, height: null, durationSeconds: null },
};
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));

it.each([
  ['bytes=2-5', '2345', 'bytes 2-5/10'],
  ['bytes=7-', '789', 'bytes 7-9/10'],
  ['bytes=-3', '789', 'bytes 7-9/10'],
  ['bytes=8-999999999999999999999', '89', 'bytes 8-9/10'],
  ['bytes=-30', '0123456789', 'bytes 0-9/10'],
])('streams the requested media bytes for %s', async (range, body, contentRange) => {
  const response = await projectAssetFileResponse(resolved, new Request('http://studio/file', { headers: { Range: range } }));
  expect(response.status).toBe(206);
  expect(response.headers.get('Accept-Ranges')).toBe('bytes');
  expect(response.headers.get('Content-Range')).toBe(contentRange);
  expect(response.headers.get('Content-Length')).toBe(String(body.length));
  expect(await response.text()).toBe(body);
});

it.each(['bytes=10-', 'bytes=-0', 'bytes=8-3', 'bytes=999999999999999999999-'])('rejects an unsatisfiable range %s', async (range) => {
  const response = await projectAssetFileResponse(resolved, new Request('http://studio/file', { headers: { Range: range } }));
  expect(response.status).toBe(416);
  expect(response.headers.get('Content-Range')).toBe('bytes */10');
  expect(await response.text()).toBe('');
});

it.each<Record<string, string>>([{}, { Range: 'bytes=0-1,4-5' }, { Range: 'unknown=0-1' }, { Range: 'bytes=2-5', 'If-Range': '"unmatched"' }])('returns the full representation when no supported unconditional single range applies', async (headers) => {
  const response = await projectAssetFileResponse(resolved, new Request('http://studio/file', { headers }));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('0123456789');
});
