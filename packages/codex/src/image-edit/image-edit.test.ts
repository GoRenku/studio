import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { createProjectDataService, initRenkuConfig } from '@gorenku/studio-core/server';
import { openCurrentProject } from '@gorenku/studio-core/server/project-selection';
import type { AssetFile } from '@gorenku/studio-core/client';
import { createFakeCostEstimator } from '../testing/fake-cost-estimator.js';
import { createCodexServer } from '../server.js';
import type {
  ImageEditConsumeResult,
  ImageEditDraft,
  ImageEditRoute,
  ImageEditGenerateReceipt,
  ImageEditSession,
  ImageEditTargetChooser,
  ImageEditTargetConsumeResult,
} from './contracts.js';

const service = createProjectDataService();
// Fictional routes: the runtime must edit with any route the Skill describes, with no model knowledge.
const route: ImageEditRoute = {
  provider: 'acme-images', providerLabel: 'Acme Images', model: 'acme/retouch', label: 'Acme Retouch',
  regionModes: [
    { id: 'paint', label: 'Paint', instructionRequired: true, placeholder: 'What goes here?' },
    { id: 'erase', label: 'Erase', instructionRequired: false, placeholder: 'Optional fill' },
  ],
  styleReference: true,
  controls: { groups: [{ label: 'Output', fields: [
    { key: '/detail', label: 'Detail', kind: 'enum', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }], initialValue: 'high' },
  ] }] },
};
const wholeImageRoute: ImageEditRoute = { ...route, model: 'acme/restyle', label: 'Acme Restyle', regionModes: null, styleReference: false, controls: { groups: [] } };

let root: string;
let homeDir: string;
let projectFolder: string;
let client: Client;
let server: ReturnType<typeof createCodexServer>;
let castMemberId: string;
let profile: AssetFile;
let olderProfile: AssetFile;
let sheet: AssetFile;
let lookbookSheet: AssetFile;
let lookbookImage: AssetFile;
let fileCount = 0;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-image-edit-'));
  homeDir = path.join(root, 'home');
  await initRenkuConfig(path.join(root, 'movies'), { homeDir });
  projectFolder = (await service.createMovieProject({ homeDir, projectName: 'movie', title: 'Image edit fixture' })).projectPath;
  await openCurrentProject({ homeDir, projectName: 'movie' });
  await service.applyCastOperations({
    homeDir, projectName: 'movie',
    document: { kind: 'castOperations', operations: [{ operation: 'castMember.add', castMember: { key: 'ana', handle: 'ana', name: 'Ana Komnene' } }] },
  } as never);
  castMemberId = (await service.listCastMembers({ homeDir })).find((member) => member.handle === 'ana')!.id;
  await fs.mkdir(path.join(projectFolder, 'tmp'), { recursive: true });
  olderProfile = await attach('cast.profile', { kind: 'castMember', id: castMemberId });
  profile = await attach('cast.profile', { kind: 'castMember', id: castMemberId }, true);
  await service.applyScreenplayOperations({
    homeDir, projectName: 'movie',
    operations: [{ operation: 'scene.add', scene: { key: 'harbor', heading: 'EXT. HARBOR - DAY', blocks: [] }, structureEntryKey: 'harbor-entry', placement: { at: 'end' } }],
  } as never);
  const [scene] = (await service.readScreenplayStructure({ homeDir, projectName: 'movie' })).screenplay.scenes;
  const [look] = (await service.writeCastLooksPlan({ homeDir, projectName: 'movie', document: { kind: 'castLooksPlan', castMemberId, looks: [{ name: 'Main', sceneIds: [scene!.id] }] } })).looks;
  const [costume] = (await service.writeCastWardrobePlan({
    homeDir, projectName: 'movie',
    document: { kind: 'castWardrobePlan', castMemberId, costumes: [{ name: 'Main', lookId: look!.id, wardrobe: ['Court robe'], continuityNotes: [], sceneIds: [scene!.id] }] },
  })).costumes;
  sheet = await attach('cast.character-sheet', { kind: 'castCostume', id: costume!.id });
  const lookbook = await service.writeProductionLookbook({ homeDir, projectName: 'movie', document: productionLookbookDocument() } as never);
  lookbookImage = await attach('lookbook.image', { kind: 'lookbook', id: lookbook.lookbook.id });
  lookbookSheet = await attach('lookbook.video-sheet', { kind: 'lookbook', id: lookbook.lookbook.id });

  const html = path.join(root, 'app.html');
  await fs.writeFile(html, '<!doctype html><html><body>Panel</body></html>');
  server = createCodexServer({ version: 'test', generationReviewHtml: html, dialogueDirectionHtml: html, imageEditHtml: html, imageEditTargetChooserHtml: html, routeChooserHtml: html, castingRoundHtml: html, castingBoardHtml: html, castingWardrobeHtml: html, costEstimator: createFakeCostEstimator(), homeDir });
  client = new Client({ name: 'codex-mcp-client', version: '1.0.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } } } as never });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client?.close();
  await server?.close();
  if (root) await fs.rm(root, { recursive: true, force: true });
});

async function writeImage(): Promise<string> {
  fileCount += 1;
  const relativePath = `tmp/image-${fileCount}.png`;
  await fs.writeFile(path.join(projectFolder, relativePath), `image ${fileCount}`);
  return relativePath;
}

async function attach(purpose: string, target: Record<string, unknown>, select = false): Promise<AssetFile> {
  const report = await service.attachGenerationMedia({
    homeDir, projectName: 'movie', purpose, target, sourceProjectRelativePath: await writeImage(), select, title: `Ana image ${fileCount + 1}`,
    generationProvenance: { provider: 'acme-images', model: 'image', mediaKind: 'image', prompt: 'Ana', request: {} },
  } as never);
  return report.assetFile as AssetFile;
}

async function importEdit(base: AssetFile, references = [base]): Promise<AssetFile> {
  const report = await service.attachGenerationMedia({
    homeDir, projectName: 'movie', purpose: 'image.edit', target: { kind: 'assetFile', assetFileId: base.id },
    sourceProjectRelativePath: await writeImage(),
    generationProvenance: { provider: route.provider, model: route.model, mediaKind: 'image', prompt: 'Edit', request: { prompt: 'Edit', image_urls: references.map((reference) => ({ $file: reference.projectRelativePath, mimeType: 'image/png', reviewLabel: 'Reference' })) } },
  } as never);
  return report.assetFile as AssetFile;
}

async function call<T>(name: string, input: Record<string, unknown>): Promise<T> {
  const result = await client.callTool({ name, arguments: input });
  if (result.isError) throw Object.assign(new Error(JSON.stringify(result.structuredContent)), { structuredContent: result.structuredContent });
  return result.structuredContent as T;
}

async function callError(name: string, input: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: input });
  expect(result.isError).toBe(true);
  return result.structuredContent as { error: { code: string; message: string }; issues?: Array<{ location?: { path?: string[] } }> };
}

async function open(sourceAssetFileId: string, openRoute: ImageEditRoute = route): Promise<ImageEditSession> {
  return (await call<{ session: ImageEditSession }>('image.edit.open', { project: 'movie', sourceAssetFileId, route: openRoute, initialWholeImageInstruction: 'Colder light.' })).session;
}

function draft(session: ImageEditSession, overrides: Partial<ImageEditDraft> = {}): ImageEditDraft {
  return {
    baseAssetFileId: session.editBaseAssetFileId!, wholeImageInstruction: '', styleReferenceAssetFileId: null, values: { '/detail': 'low' },
    regions: [
      { number: 1, mode: 'paint', box: { top: 20, left: 270, bottom: 290, right: 730 }, instruction: 'Replace the crown with the helmet from Props.' },
      { number: 2, mode: 'erase', box: { top: 40, left: 0, bottom: 550, right: 130 }, instruction: '' },
    ],
    ...overrides,
  };
}

async function readSession(sessionId: string): Promise<ImageEditSession> {
  const result = await client.readResource({ uri: `renku-image-edit://${sessionId}` });
  return JSON.parse((result.contents[0] as { text: string }).text) as ImageEditSession;
}

async function deleteStyleSheet(assetFileId: string): Promise<void> {
  const lookbook = await service.readProductionLookbook({ homeDir, projectName: 'movie' });
  const sheet = lookbook.sheets.find((entry) => entry.assetFile.id === assetFileId)!;
  await service.deleteLookbookSheet({ homeDir, projectName: 'movie', sheetId: sheet.id });
}

describe('image edit sessions', () => {
  it('opens on the exact source with its owner, take number, selection and initial direction', async () => {
    const session = await open(profile.id);
    expect(session).toMatchObject({
      route, owner: { kind: 'castMember', name: 'Ana Komnene' }, imageType: 'cast_profile', selectable: true,
      editBaseAssetFileId: profile.id, action: null, initialWholeImageInstruction: 'Colder light.',
    });
    expect(session.versions).toEqual([expect.objectContaining({ assetFileId: profile.id, takeNumber: 2, parentAssetFileId: null, selected: true })]);
    expect(session.styleReferences.map((reference) => [reference.assetFileId, reference.lookbook, reference.lookbookName])).toEqual([[lookbookSheet.id, 'production', 'Production Language']]);
    expect(session.styleReferences.map((reference) => reference.assetFileId)).not.toContain(lookbookImage.id);
    expect(session.versions[0]!.imageUri).toMatch(/^renku-image-edit:\/\//);
    const media = await client.readResource({ uri: session.versions[0]!.imageUri });
    expect(media.contents[0]).toMatchObject({ mimeType: 'image/png' });
  });

  it('collects every draft issue before recording an action', async () => {
    const session = await open(profile.id);
    const failure = await callError('image.edit.generate', {
      sessionId: session.sessionId,
      draft: draft(session, {
        baseAssetFileId: olderProfile.id,
        styleReferenceAssetFileId: 'asset_file_unknown',
        regions: [
          { number: 1, mode: 'paint', box: { top: 0, left: 0, bottom: 1200, right: 100 }, instruction: ' ' },
          { number: 1, mode: 'erase', box: { top: 100, left: 100, bottom: 105, right: 400 }, instruction: '' },
          { number: 3, mode: 'edit', box: { top: 100, left: 100, bottom: 400, right: 400 }, instruction: 'x' },
        ],
        values: { '/detail': 'ultra', '/extra': 1 },
      }),
    });
    expect(failure.error.code).toBe('CODEX_IMAGE_EDIT_INVALID');
    expect(failure.issues!.map((issue) => issue.location?.path?.join('.'))).toEqual([
      'draft.baseAssetFileId', 'draft.styleReferenceAssetFileId', 'draft.regions.0.instruction', 'draft.regions.0.box', 'draft.regions.1.number', 'draft.regions.1.box',
      'draft.regions.2.mode', 'draft.values./extra', 'draft.values./detail',
    ]);
    expect((await readSession(session.sessionId)).action).toBeNull();
  });

  it('requires a change or a region and every control value', async () => {
    const session = await open(profile.id);
    const empty = await callError('image.edit.generate', { sessionId: session.sessionId, draft: draft(session, { regions: [], wholeImageInstruction: ' ', values: {} }) });
    expect(empty.issues!.map((issue) => issue.location?.path?.join('.'))).toEqual(['draft', 'draft.values./detail']);
  });

  it('reports every Route Description inconsistency together', async () => {
    const failure = await callError('image.edit.open', { project: 'movie', sourceAssetFileId: profile.id, initialWholeImageInstruction: '', route: {
      ...route,
      regionModes: [route.regionModes![0], route.regionModes![0]],
      controls: { groups: [{ label: 'Output', fields: [{ key: '/mask', label: 'Mask', kind: 'array', element: { key: 'x', label: 'X', kind: 'number' } }] }] },
    } });
    expect(failure.issues!.map((issue) => issue.location?.path?.join('.'))).toEqual([
      'route.regionModes', 'route.controls.groups.0.fields.0.kind', 'route.controls.groups.0.fields.0.initialValue',
    ]);
    const emptyModes = await callError('image.edit.open', { project: 'movie', sourceAssetFileId: profile.id, initialWholeImageInstruction: '', route: { ...route, regionModes: [] } });
    expect(emptyModes.issues!.map((issue) => issue.location?.path?.join('.'))).toEqual(['route.regionModes']);
  });

  it('runs one Generate through consume and report, adds the selected result as a version and moves the edit base to it', async () => {
    const session = await open(profile.id);
    const receipt = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(session) });
    expect(receipt.session.action).toMatchObject({ actionId: receipt.actionId, baseAssetFileId: profile.id, status: 'pending' });
    expect((await callError('image.edit.generate', { sessionId: session.sessionId, draft: draft(session) })).error.code).toBe('CODEX_IMAGE_EDIT_BUSY');

    const consumed = await call<ImageEditConsumeResult>('image.edit.consume', { sessionId: session.sessionId, actionId: receipt.actionId });
    expect(consumed).toMatchObject({
      status: 'consumed', project: 'movie', provider: route.provider, model: route.model,
      base: { assetFileId: profile.id, projectRelativePath: profile.projectRelativePath }, styleReference: null,
      draft: { regions: [expect.objectContaining({ number: 1 }), expect.objectContaining({ number: 2, mode: 'erase' })], values: { '/detail': 'low' } },
    });
    expect(await call<ImageEditConsumeResult>('image.edit.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).toMatchObject({ status: 'alreadyConsumed' });

    expect((await callError('image.edit.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: sheet.id } })).error.code).toBe('CODEX_IMAGE_EDIT_INVALID');
    expect((await callError('image.edit.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: olderProfile.id } })).error.code).toBe('CODEX_IMAGE_EDIT_INVALID');
    const edit = await importEdit(profile);
    const reported = (await call<{ session: ImageEditSession }>('image.edit.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: edit.id } })).session;
    expect(reported).toMatchObject({ action: null, lastCompletedAction: { actionId: receipt.actionId, assetFileId: edit.id }, editBaseAssetFileId: edit.id });
    expect(reported.versions.map((version) => [version.assetFileId, version.parentAssetFileId, version.selected])).toEqual([
      [profile.id, null, false],
      [edit.id, profile.id, true],
    ]);

    await service.selectAssetFile({ homeDir, projectName: 'movie', target: { kind: 'castMember', id: castMemberId }, assetFileId: olderProfile.id });
    const followed = await readSession(session.sessionId);
    expect(followed.editBaseAssetFileId).toBe(olderProfile.id);
    expect(followed.versions.at(-1)).toMatchObject({ assetFileId: olderProfile.id, parentAssetFileId: null, selected: true });

    await service.discardAssetFile({ homeDir, projectName: 'movie', owner: { kind: 'castMember', id: castMemberId }, assetFileId: olderProfile.id });
    const unselected = await readSession(session.sessionId);
    expect(unselected.editBaseAssetFileId).toBeNull();
    expect((await callError('image.edit.generate', { sessionId: session.sessionId, draft: draft(followed) })).error.code).toBe('CODEX_IMAGE_EDIT_INVALID');
  });

  it('reports a failed action back to the panel and allows another Generate', async () => {
    const source = await attach('cast.profile', { kind: 'castMember', id: castMemberId }, true);
    const session = await open(source.id);
    const receipt = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(session) });
    await call('image.edit.consume', { sessionId: session.sessionId, actionId: receipt.actionId });
    const failed = (await call<{ session: ImageEditSession }>('image.edit.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'failed', message: 'Fal rejected the request.' } })).session;
    expect(failed.action).toMatchObject({ status: 'failed', message: 'Fal rejected the request.' });
    expect(await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(session) })).toMatchObject({ session: { action: { status: 'pending' } } });
  });

  it('keeps every version of the lineage, including an edit imported after its action was reported failed', async () => {
    const source = await attach('cast.profile', { kind: 'castMember', id: castMemberId }, true);
    const session = await open(source.id);
    const first = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(session) });
    await call('image.edit.consume', { sessionId: session.sessionId, actionId: first.actionId });
    await call('image.edit.report', { sessionId: session.sessionId, actionId: first.actionId, outcome: { status: 'failed', message: 'Approval was blocked.' } });
    const second = await importEdit(source);

    const recovered = await readSession(session.sessionId);
    expect(recovered.editBaseAssetFileId).toBe(second.id);
    const next = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(recovered) });
    await call('image.edit.consume', { sessionId: session.sessionId, actionId: next.actionId });
    const third = await importEdit(second);
    const reported = (await call<{ session: ImageEditSession }>('image.edit.report', { sessionId: session.sessionId, actionId: next.actionId, outcome: { status: 'attached', assetFileId: third.id } })).session;

    expect(reported.versions.map((version) => [version.assetFileId, version.parentAssetFileId, version.selected])).toEqual([
      [source.id, null, false],
      [second.id, source.id, false],
      [third.id, second.id, true],
    ]);
  });

  it('starts each edit of an image without selection from the newest session version', async () => {
    const session = await open(sheet.id);
    expect(session).toMatchObject({ selectable: false, imageType: 'character_sheet', editBaseAssetFileId: sheet.id });
    const receipt = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(session) });
    await call('image.edit.consume', { sessionId: session.sessionId, actionId: receipt.actionId });
    const edit = await importEdit(sheet);
    const reported = (await call<{ session: ImageEditSession }>('image.edit.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: edit.id } })).session;
    expect(reported.editBaseAssetFileId).toBe(edit.id);
    expect(reported.versions.every((version) => !version.selected)).toBe(true);
  });

  it('completes edits of an outside Studio selection and retains that lineage through later selection changes', async () => {
    const source = await attach('cast.profile', { kind: 'castMember', id: castMemberId }, true);
    const sibling = await attach('cast.profile', { kind: 'castMember', id: castMemberId });
    const session = await open(source.id);
    await service.selectAssetFile({ homeDir, projectName: 'movie', target: { kind: 'castMember', id: castMemberId }, assetFileId: sibling.id });
    const selected = await readSession(session.sessionId);
    expect(selected.editBaseAssetFileId).toBe(sibling.id);
    const receipt = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(selected) });
    expect(await call<ImageEditConsumeResult>('image.edit.consume', { sessionId: session.sessionId, actionId: receipt.actionId }))
      .toMatchObject({ status: 'consumed', base: { assetFileId: sibling.id } });
    const edit = await importEdit(sibling);
    // Reporting belongs to the action's base even if Studio changes selection again.
    await service.selectAssetFile({ homeDir, projectName: 'movie', target: { kind: 'castMember', id: castMemberId }, assetFileId: source.id });
    const reported = (await call<{ session: ImageEditSession }>('image.edit.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: edit.id } })).session;
    expect(reported).toMatchObject({ action: null, lastCompletedAction: { assetFileId: edit.id }, editBaseAssetFileId: source.id });
    expect(reported.versions.map((version) => [version.assetFileId, version.parentAssetFileId])).toEqual([
      [source.id, null], [sibling.id, null], [edit.id, sibling.id],
    ]);

    await service.selectAssetFile({ homeDir, projectName: 'movie', target: { kind: 'castMember', id: castMemberId }, assetFileId: edit.id });
    const next = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(await readSession(session.sessionId)) });
    await call('image.edit.consume', { sessionId: session.sessionId, actionId: next.actionId });
    const second = await importEdit(edit, [edit, sibling]);
    const completed = (await call<{ session: ImageEditSession }>('image.edit.report', { sessionId: session.sessionId, actionId: next.actionId, outcome: { status: 'attached', assetFileId: second.id } })).session;
    expect(completed).toMatchObject({ action: null, editBaseAssetFileId: second.id });
    expect(completed.versions.map((version) => [version.assetFileId, version.parentAssetFileId])).toEqual([
      [source.id, null], [sibling.id, null], [edit.id, sibling.id], [second.id, edit.id],
    ]);
    expect((await readSession(session.sessionId)).versions).toEqual(completed.versions);
  });

  it('refreshes style sheets added and deleted while the panel is open and rejects stale Generate choices', async () => {
    const source = await attach('cast.profile', { kind: 'castMember', id: castMemberId }, true);
    const session = await open(source.id);
    const style = await attach('lookbook.video-sheet', lookbookSheet.owner);
    expect(session.styleReferences.map((reference) => reference.assetFileId)).not.toContain(style.id);
    expect((await readSession(session.sessionId)).styleReferences.map((reference) => reference.assetFileId)).toContain(style.id);

    await deleteStyleSheet(style.id);
    expect((await readSession(session.sessionId)).styleReferences.map((reference) => reference.assetFileId)).not.toContain(style.id);
    const failure = await callError('image.edit.generate', { sessionId: session.sessionId, draft: draft(session, { styleReferenceAssetFileId: style.id }) });
    expect(failure.error.code).toBe('CODEX_IMAGE_EDIT_INVALID');
    expect(failure.issues).toContainEqual(expect.objectContaining({ location: expect.objectContaining({ path: ['draft', 'styleReferenceAssetFileId'] }) }));
    expect((await readSession(session.sessionId)).action).toBeNull();
  });

  it('fails consume when the style sheet is deleted after Generate and permits another action', async () => {
    const source = await attach('cast.profile', { kind: 'castMember', id: castMemberId }, true);
    const style = await attach('lookbook.video-sheet', lookbookSheet.owner);
    const session = await open(source.id);
    const receipt = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(session, { styleReferenceAssetFileId: style.id }) });
    await deleteStyleSheet(style.id);

    const failure = await callError('image.edit.consume', { sessionId: session.sessionId, actionId: receipt.actionId });
    expect(failure.error).toMatchObject({ code: 'CODEX_IMAGE_EDIT_INVALID', message: 'The selected style reference is no longer available.' });
    const failed = await readSession(session.sessionId);
    expect(failed.action).toMatchObject({ status: 'failed', message: failure.error.message });
    expect(await call('image.edit.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).toMatchObject({ status: 'alreadyConsumed' });
    const retry = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(failed) });
    expect(await call('image.edit.consume', { sessionId: session.sessionId, actionId: retry.actionId })).toMatchObject({ status: 'consumed', styleReference: null });
  });

  it('resolves the current style sheet metadata through Core when consuming', async () => {
    const source = await attach('cast.profile', { kind: 'castMember', id: castMemberId }, true);
    const style = await attach('lookbook.video-sheet', lookbookSheet.owner);
    const session = await open(source.id);
    const receipt = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(session, { styleReferenceAssetFileId: style.id }) });
    await service.updateAssetFile({ homeDir, projectName: 'movie', assetFileId: style.id, title: 'Updated lighting reference' });

    expect(await call('image.edit.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).toMatchObject({
      status: 'consumed', styleReference: { assetFileId: style.id, projectRelativePath: style.projectRelativePath, name: 'Updated lighting reference' },
    });
  });

  it('edits the whole image with a region-free route that takes no style reference', async () => {
    const source = await attach('cast.profile', { kind: 'castMember', id: castMemberId }, true);
    const session = await open(source.id, wholeImageRoute);
    expect(session).toMatchObject({ route: wholeImageRoute, styleReferences: [] });
    const rejected = await callError('image.edit.generate', { sessionId: session.sessionId, draft: draft(session, { values: {}, styleReferenceAssetFileId: lookbookSheet.id }) });
    expect(rejected.issues!.map((issue) => issue.location?.path?.join('.'))).toEqual(['draft.styleReferenceAssetFileId', 'draft.regions']);
    const receipt = await call<ImageEditGenerateReceipt>('image.edit.generate', { sessionId: session.sessionId, draft: draft(session, { regions: [], wholeImageInstruction: 'Warmer dusk light.', values: {} }) });
    expect(await call<ImageEditConsumeResult>('image.edit.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).toMatchObject({
      status: 'consumed', provider: 'acme-images', model: 'acme/restyle', styleReference: null,
      draft: { regions: [], wholeImageInstruction: 'Warmer dusk light.', values: {} },
    });
  });
});

describe('Image edit target chooser', () => {
  it('records one answer and hands it to the agent once', async () => {
    const opened = (await call<{ chooser: ImageEditTargetChooser }>('image.edit.target.choose', { project: 'movie', assetFileIds: [profile.id, sheet.id], suggestedAssetFileId: profile.id })).chooser;
    expect(opened).toMatchObject({ suggestedAssetFileId: profile.id, choice: null });
    expect(opened.candidates.map((candidate) => [candidate.assetFileId, candidate.imageType, candidate.owner.name])).toEqual([
      [profile.id, 'cast_profile', 'Ana Komnene'],
      [sheet.id, 'character_sheet', 'Ana Komnene'],
    ]);
    expect((await callError('image.edit.target.consume', { chooserId: opened.chooserId })).error.code).toBe('CODEX_IMAGE_EDIT_INVALID');
    expect((await callError('image.edit.target.respond', { chooserId: opened.chooserId, choice: { status: 'chosen', assetFileId: olderProfile.id } })).error.code).toBe('CODEX_IMAGE_EDIT_INVALID');

    const answered = (await call<{ chooser: ImageEditTargetChooser }>('image.edit.target.respond', { chooserId: opened.chooserId, choice: { status: 'chosen', assetFileId: sheet.id } })).chooser;
    expect(answered.choice).toEqual({ status: 'chosen', assetFileId: sheet.id });
    expect((await callError('image.edit.target.respond', { chooserId: opened.chooserId, choice: { status: 'canceled' } })).error.code).toBe('CODEX_IMAGE_EDIT_INVALID');
    expect(await call<ImageEditTargetConsumeResult>('image.edit.target.consume', { chooserId: opened.chooserId })).toEqual({ status: 'chosen', chooserId: opened.chooserId, project: 'movie', assetFileId: sheet.id });
    expect(await call<ImageEditTargetConsumeResult>('image.edit.target.consume', { chooserId: opened.chooserId })).toEqual({ status: 'alreadyConsumed', chooserId: opened.chooserId });
  });

  it('refuses a suggestion outside the candidates and invalid candidates', async () => {
    expect((await callError('image.edit.target.choose', { project: 'movie', assetFileIds: [profile.id, sheet.id], suggestedAssetFileId: olderProfile.id })).error.code).toBe('CODEX_IMAGE_EDIT_INVALID');
    expect((await callError('image.edit.target.choose', { project: 'movie', assetFileIds: [profile.id, 'asset_file_missing'], suggestedAssetFileId: profile.id })).error.code).toBe('CORE_IMAGE_EDIT_TARGET_INVALID');
  });
});

function productionLookbookDocument() {
  return {
    kind: 'productionLookbook' as const,
    productionLookbook: {
      name: 'Production Language',
      thesis: { statement: 'Held monumental frames.', principles: ['Keep scale legible.'] },
      palette: { description: 'Stone and ember.', colors: [{ hex: '#8A6437', name: 'Worked bronze', meaning: 'Engineered force.' }], observations: [] },
      toneMood: { tone: 'severe', moodTags: ['monumental'], description: 'Restrained pressure.' },
      composition: { description: 'Stable axes.', patterns: [{ name: 'Held center', description: 'Keep mass legible.' }] },
      lighting: { description: 'Low sun and fire.', patterns: [{ name: 'Ember edge', description: 'Use fire as a narrow accent.' }] },
      texture: { description: 'Stone and smoke.', observations: [] },
      camera: {
        description: 'Measured movement.',
        movement: [{ name: 'Slow push', description: 'Move only as decisions harden.' }],
        motion: [{ name: 'Held weight', description: 'Let labor remain deliberate.' }],
        framing: [{ name: 'Human scale', description: 'Keep bodies small against masonry.' }],
      },
    },
    sourceInspirationFolderIds: [],
  };
}
