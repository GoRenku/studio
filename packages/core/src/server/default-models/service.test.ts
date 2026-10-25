import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_LIST_MAX_BYTES } from './document.js';
import { readDefaultModelList, readImageDetailFields, syncDefaultModelList } from './service.js';
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

function fictionalList(): { formatVersion: number; lanes: Record<string, Array<{ model: string; name: string; providers: Array<{ provider: string; route: string; detail?: unknown }>; recommendedFor: string[] }>> } {
  return {
    formatVersion: 1,
    lanes: {
      image: [],
      imageEdit: [
        { model: 'fictional-edit-2', name: 'Fictional Edit 2', providers: [{ provider: 'provider-one', route: 'fictional/provider-one', detail: { lowest: { size: 'small' }, mid: { size: 'medium' }, highest: { size: 'large' } } }, { provider: 'provider-two', route: 'fictional/provider-two', detail: { lowest: { size: 'small' }, mid: { size: 'medium' }, highest: { size: 'large' } } }], recommendedFor: ['provider-one'] },
        { model: 'fictional-edit-1.5', name: 'Fictional Edit 1.5', providers: [{ provider: 'provider-two', route: 'fictional/provider-two', detail: { lowest: { size: 'small' }, mid: { size: 'medium' }, highest: { size: 'large' } } }], recommendedFor: ['provider-two'] },
      ],
      video: [{ model: 'fictional-video', name: 'Fictional Video', providers: [{ provider: 'provider-one', route: 'fictional/provider-one' }], recommendedFor: [] }],
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
    list.lanes.audio = [{ model: 'fictional-voice', name: 'Fictional Voice', providers: [{ provider: 'provider-three', route: 'fictional/provider-three' }], recommendedFor: ['provider-three'] }];
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
      { model: 'fictional-video', name: 'A', providers: [{ provider: 'provider-one', route: 'fictional/provider-one' }], recommendedFor: [] },
      { model: 'fictional-video', name: 'B', providers: [{ provider: 'provider-two', route: 'fictional/provider-two' }], recommendedFor: [] },
    ] } }],
    ['two recommendations for one provider', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: [{ provider: 'provider-one', route: 'fictional/provider-one' }], recommendedFor: ['provider-one'] },
      { model: 'fictional-video-2', name: 'B', providers: [{ provider: 'provider-one', route: 'fictional/provider-one' }], recommendedFor: ['provider-one'] },
    ] } }],
    ['recommendation outside providers', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: [{ provider: 'provider-one', route: 'fictional/provider-one' }], recommendedFor: ['provider-two'] },
    ] } }],
    ['provider without a route', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: [{ provider: 'provider-one' }], recommendedFor: [] },
    ] } }],
    ['provider listed twice', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: [{ provider: 'provider-one', route: 'a' }, { provider: 'provider-one', route: 'b' }], recommendedFor: [] },
    ] } }],
    ['an image edit provider without detail levels', { ...fictionalList(), lanes: { ...fictionalList().lanes, imageEdit: [
      { model: 'fictional-edit-2', name: 'A', providers: [{ provider: 'provider-one', route: 'a' }], recommendedFor: [] },
    ] } }],
    ['a detail level that is not an object', { ...fictionalList(), lanes: { ...fictionalList().lanes, imageEdit: [
      { model: 'fictional-edit-2', name: 'A', providers: [{ provider: 'provider-one', route: 'a', detail: { lowest: {}, mid: {}, highest: '4K' } }], recommendedFor: [] },
    ] } }],
    ['detail levels on a video provider', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: [{ provider: 'provider-one', route: 'a', detail: { lowest: {}, mid: {}, highest: {} } }], recommendedFor: [] },
    ] } }],
    ['empty providers', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'fictional-video', name: 'A', providers: [], recommendedFor: [] },
    ] } }],
    ['invalid model key', { ...fictionalList(), lanes: { ...fictionalList().lanes, video: [
      { model: 'Fictional Video', name: 'A', providers: [{ provider: 'provider-one', route: 'fictional/provider-one' }], recommendedFor: [] },
    ] } }],
    ['malformed JSON', '{'],
  ])('rejects %s without writing a copy', async (_name, value) => {
    const file = await writeSource(value);
    await expect(syncDefaultModelList({ homeDir, file })).rejects.toMatchObject({ code: 'DEFAULT_MODELS001' });
    await expect(readDefaultModelList({ homeDir })).resolves.toEqual({ state: 'notSynced' });
  });

  it('replaces a stored copy that no longer matches the current list shape', async () => {
    const file = await writeSource(fictionalList());
    await fs.mkdir(path.dirname(resolveDefaultModelListPath({ homeDir })), { recursive: true });
    await fs.writeFile(resolveDefaultModelListPath({ homeDir }), JSON.stringify({ formatVersion: 1, syncedAt: '2026-10-01T00:00:00.000Z', sha256: 'f'.repeat(64), lanes: { image: [{ providers: ['provider-one'] }] } }));
    await expect(syncDefaultModelList({ homeDir, file })).resolves.toMatchObject({ changed: true });
    await expect(readDefaultModelList({ homeDir })).resolves.toMatchObject({ state: 'synced', lanes: fictionalList().lanes });
  });

  it('reads the native fields of one detail level for an image route', async () => {
    await expect(readImageDetailFields({ homeDir, provider: 'provider-one', route: 'fictional/provider-one', level: 'mid' })).rejects.toMatchObject({ code: 'DEFAULT_MODELS004' });
    await syncDefaultModelList({ homeDir, file: await writeSource(fictionalList()) });
    await expect(readImageDetailFields({ homeDir, provider: 'provider-one', route: 'fictional/provider-one', level: 'mid' })).resolves.toEqual({ size: 'medium' });
    await expect(readImageDetailFields({ homeDir, provider: 'provider-one', route: 'fictional/unlisted', level: 'mid' })).rejects.toMatchObject({ code: 'DEFAULT_MODELS005' });
  });

  it('rejects a list larger than the size limit', async () => {
    const list = fictionalList();
    list.lanes.image = [{ model: 'fictional-image', name: 'x'.repeat(DEFAULT_MODEL_LIST_MAX_BYTES), providers: [{ provider: 'provider-one', route: 'fictional/provider-one' }], recommendedFor: [] }];
    await expect(syncDefaultModelList({ homeDir, file: await writeSource(list) })).rejects.toMatchObject({ code: 'DEFAULT_MODELS001' });
  });

  it('reports an unreadable source file', async () => {
    await expect(syncDefaultModelList({ homeDir, file: path.join(sourceDir, 'missing.json') }))
      .rejects.toMatchObject({ code: 'DEFAULT_MODELS003' });
  });
});
