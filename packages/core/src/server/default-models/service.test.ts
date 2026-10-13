import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_LIST_MAX_BYTES } from './document.js';
import { readDefaultModelList, syncDefaultModelList } from './service.js';
import { resolveDefaultModelListPath } from './store.js';

let homeDir: string;
let sourceDir: string;

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-default-models-'));
  sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-default-models-source-'));
});

afterEach(async () => {
  await fs.rm(homeDir, { recursive: true, force: true });
  await fs.rm(sourceDir, { recursive: true, force: true });
});

function fictionalList(): { formatVersion: number; lanes: Record<string, Array<{ model: string; name: string; providers: string[]; recommendedFor: string[] }>> } {
  return {
    formatVersion: 1,
    lanes: {
      image: [],
      imageEdit: [
        { model: 'fictional-edit-2', name: 'Fictional Edit 2', providers: ['provider-one', 'provider-two'], recommendedFor: ['provider-one'] },
        { model: 'fictional-edit-1.5', name: 'Fictional Edit 1.5', providers: ['provider-two'], recommendedFor: ['provider-two'] },
      ],
      video: [{ model: 'fictional-video', name: 'Fictional Video', providers: ['provider-one'], recommendedFor: [] }],
      audio: [],
    },
  };
}

async function writeSource(value: unknown): Promise<string> {
  const file = path.join(sourceDir, 'default-models.json');
  await fs.writeFile(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
  return file;
}

describe('Default Model List', () => {
  it('reports notSynced before the first sync', async () => {
    await expect(readDefaultModelList({ homeDir })).resolves.toEqual({ state: 'notSynced' });
  });

  it('stores a copy in the Renku state directory and is a no-op for unchanged content', async () => {
    const file = await writeSource(fictionalList());
    const first = await syncDefaultModelList({ homeDir, file, now: () => new Date('2026-10-12T10:00:00Z') });
    expect(first).toEqual({
      changed: true,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      path: path.join(homeDir, '.local', 'state', 'renku', 'default-models.json'),
    });
    const before = await fs.stat(resolveDefaultModelListPath({ homeDir }));

    const second = await syncDefaultModelList({ homeDir, file, now: () => new Date('2026-10-13T10:00:00Z') });
    expect(second).toEqual({ ...first, changed: false });
    expect((await fs.stat(resolveDefaultModelListPath({ homeDir }))).mtimeMs).toBe(before.mtimeMs);

    await expect(readDefaultModelList({ homeDir })).resolves.toEqual({
      state: 'synced',
      syncedAt: '2026-10-12T10:00:00.000Z',
      lanes: fictionalList().lanes,
    });
  });

  it('replaces the copy when the Skill list changes', async () => {
    const list = fictionalList();
    const first = await syncDefaultModelList({ homeDir, file: await writeSource(list) });
    list.lanes.audio = [{ model: 'fictional-voice', name: 'Fictional Voice', providers: ['provider-three'], recommendedFor: ['provider-three'] }];
    const second = await syncDefaultModelList({ homeDir, file: await writeSource(list) });
    expect(second.changed).toBe(true);
    expect(second.sha256).not.toBe(first.sha256);
    const resource = await readDefaultModelList({ homeDir });
    expect(resource.state === 'synced' && resource.lanes.audio).toEqual(list.lanes.audio);
  });

  it.each([
    ['unknown lane', { ...fictionalList(), lanes: { ...fictionalList().lanes, videoEdit: [] } }],
    ['missing lane', { formatVersion: 1, lanes: { image: [], imageEdit: [], video: [] } }],
    ['wrong format version', { ...fictionalList(), formatVersion: 2 }],
    ['duplicate model key', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: ['provider-one'], recommendedFor: [] },
      { model: 'fictional-video', name: 'B', providers: ['provider-two'], recommendedFor: [] },
    ] } }],
    ['two recommendations for one provider', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: ['provider-one'], recommendedFor: ['provider-one'] },
      { model: 'fictional-video-2', name: 'B', providers: ['provider-one'], recommendedFor: ['provider-one'] },
    ] } }],
    ['recommendation outside providers', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: ['provider-one'], recommendedFor: ['provider-two'] },
    ] } }],
    ['empty providers', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: [], recommendedFor: [] },
    ] } }],
    ['invalid model key', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'Fictional Video', name: 'A', providers: ['provider-one'], recommendedFor: [] },
    ] } }],
    ['malformed JSON', '{'],
  ])('rejects %s without writing a copy', async (_name, value) => {
    const file = await writeSource(value);
    await expect(syncDefaultModelList({ homeDir, file })).rejects.toMatchObject({ code: 'DEFAULT_MODELS001' });
    await expect(readDefaultModelList({ homeDir })).resolves.toEqual({ state: 'notSynced' });
  });

  it('rejects a list larger than the size limit', async () => {
    const list = fictionalList();
    list.lanes.image = [{ model: 'fictional-image', name: 'x'.repeat(DEFAULT_MODEL_LIST_MAX_BYTES), providers: ['provider-one'], recommendedFor: [] }];
    await expect(syncDefaultModelList({ homeDir, file: await writeSource(list) })).rejects.toMatchObject({ code: 'DEFAULT_MODELS001' });
  });

  it('reports an unreadable source file', async () => {
    await expect(syncDefaultModelList({ homeDir, file: path.join(sourceDir, 'missing.json') }))
      .rejects.toMatchObject({ code: 'DEFAULT_MODELS003' });
  });
});
