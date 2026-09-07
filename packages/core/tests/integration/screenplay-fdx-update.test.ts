import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { createProjectDataService } from '../../src/server/index.js';
import { createBlankMovieProject, writeConfig } from '../../src/server/testing/project-data-fixtures.js';
import { fdxUpdateReviewSchema, fdxUpdateStatusSchema } from '../../src/client/screenplay/fdx-updates.js';

const service = createProjectDataService();
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const scene = (name: string, speech = 'Wait.', number = name) => `<Paragraph Type="Scene Heading" Number="${number}"><Text>INT. ${name} - DAY</Text></Paragraph><Paragraph Type="Character"><Text>MARA</Text></Paragraph><Paragraph Type="Dialogue"><Text>${speech}</Text></Paragraph>`;
const fdx = (content: string) => `<FinalDraft DocumentType="Script"><Content>${content}</Content></FinalDraft>`;
const original = fdx(scene('A') + scene('B'));

describe('reviewed external FDX updates', () => {
  let input: { projectName: string; homeDir: string };
  let projectFolder: string;
  let exportPath: string;
  let sourcePath: string;
  beforeEach(async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fdx-update-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const project = await createBlankMovieProject({ homeDir, projectData: service });
    input = { homeDir, projectName: project!.projectName };
    projectFolder = path.join(homeDir, 'projects', input.projectName);
    sourcePath = path.join(homeDir, 'initial.fdx');
    await fs.writeFile(sourcePath, original);
    await service.importFdxScreenplay({ ...input, sourcePath });
    exportPath = (await service.prepareFdxExportFolder(input)).exportPath;
  });

  async function review(text: string) {
    await fs.writeFile(exportPath, text);
    return service.reviewFdxUpdate({ ...input, sourceSha256: hash(text) });
  }
  const screenplay = () => service.readScreenplayStructure(input);
  const revisions = () => service.listScreenplayRevisions(input);

  it('creates only the directory and compares against accepted bytes on entry/reopen without writes', async () => {
    const before = await screenplay();
    const history = await revisions();
    expect(await fs.readdir(path.dirname(exportPath))).toEqual([]);
    expect(await service.readFdxUpdateStatus(input)).toMatchObject({ state: 'missing', acceptedSourceSha256: hash(original) });
    await fs.writeFile(path.join(path.dirname(exportPath), 'other.fdx'), fdx(scene('OTHER')));
    expect(await service.readFdxUpdateStatus(input)).toMatchObject({ state: 'missing' });
    await fs.writeFile(exportPath, original);
    expect(await service.readFdxUpdateStatus(input)).toMatchObject({ state: 'current' });
    const changed = fdx(scene('A', 'Wait!') + scene('B'));
    await fs.writeFile(exportPath, changed);
    const status = await service.readFdxUpdateStatus(input);
    expect(status).toMatchObject({ state: 'pending', sourceSha256: hash(changed) });
    expect(new Ajv2020().compile(fdxUpdateStatusSchema)(status)).toBe(true);
    expect(await screenplay()).toEqual(before);
    expect(await revisions()).toEqual(history);
    expect(await fs.readFile(exportPath, 'utf8')).toBe(changed);
  });

  it('requires FDX ownership without creating a handoff for authored Projects', async () => {
    const blank = await createBlankMovieProject({ homeDir: input.homeDir, projectData: service, projectName: 'authored', title: 'Authored' });
    const other = { ...input, projectName: blank!.projectName };
    expect(await service.readFdxUpdateStatus(other)).toEqual({ state: 'notApplicable' });
    await expect(service.prepareFdxExportFolder(other)).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_UPDATE_NOT_APPLICABLE' });
  });

  it.each([
    ['dialogue punctuation', fdx(scene('A', 'Wait!') + scene('B')), 1, 1, false],
    ['dialogue addition', fdx(scene('A') + '<Paragraph Type="Dialogue"><Text>Go.</Text></Paragraph>' + scene('B')), 1, 1, false],
    ['dialogue removal', fdx('<Paragraph Type="Scene Heading" Number="A"><Text>INT. A - DAY</Text></Paragraph>' + scene('B')), 1, 1, false],
    ['heading', fdx(scene('C', 'Wait.', 'A') + scene('B')), 1, 1, false],
    ['number', fdx(scene('A', 'Wait.', '3B') + scene('B')), 1, 1, false],
    ['action addition', fdx(scene('A') + '<Paragraph Type="Action"><Text>A door opens.</Text></Paragraph>' + scene('B')), 1, 1, false],
    ['insertion', fdx(scene('NEW') + scene('A') + scene('B')), 0, 1, false],
    ['deletion', fdx(scene('B')), 1, 0, false],
    ['reorder', fdx(scene('B') + scene('A')), 0, 0, true],
    ['opening', fdx('<Paragraph Type="Action"><Text>Darkness.</Text></Paragraph>' + scene('A') + scene('B')), 0, 0, false],
    ['duplicate', fdx(scene('A') + scene('A') + scene('B')), 1, 2, false],
  ] as const)('predicts %s from actual identities and preserves unchanged nested graphs', async (_name, text, removed, added, reordered) => {
    const before = await screenplay();
    const candidate = await review(text);
    expect(candidate.removedOrReplacedScenes).toHaveLength(removed);
    expect(candidate.newScenes).toHaveLength(added);
    expect(candidate.survivingSceneOrderChanged).toBe(reordered);
    expect(candidate.diagnostics.length).toBe(removed ? 1 : 0);
    expect(new Ajv2020().compile(fdxUpdateReviewSchema)(candidate)).toBe(true);
    expect(await screenplay()).toEqual(before);
    await service.applyFdxUpdate({ ...input, reviewFingerprint: candidate.reviewFingerprint });
    const after = await screenplay();
    const removedIds = new Set(candidate.removedOrReplacedScenes.map((row) => row.sceneId));
    for (const old of before.screenplay.scenes) {
      if (removedIds.has(old.id)) expect(after.screenplay.scenes.some((row) => row.id === old.id)).toBe(false);
      else expect(after.screenplay.scenes.find((row) => row.id === old.id)).toEqual(old);
    }
    expect(after.screenplay.scenes.filter((row) => !before.screenplay.scenes.some((old) => old.id === row.id)).map((row) => row.id))
      .toEqual(candidate.newScenes.map((row) => row.sceneId));
  });

  it('retains source-only history without a revision and accepts simultaneous confirmations once', async () => {
    const before = await screenplay();
    const history = await revisions();
    const candidate = await review(original.replace('<Content>', '<Content>\n'));
    expect(candidate.change).toBe('sourceOnly');
    const reports = await Promise.all([1, 2].map(() => service.applyFdxUpdate({ ...input, reviewFingerprint: candidate.reviewFingerprint })));
    expect(reports.map((report) => report.status).sort()).toEqual(['refreshed', 'unchanged']);
    expect(reports.find((report) => report.status === 'refreshed')?.resourceKeys).toEqual(['surface:project:assets']);
    expect(await screenplay()).toEqual(before);
    expect(await revisions()).toEqual(history);
    const prior = await review(original);
    await service.applyFdxUpdate({ ...input, reviewFingerprint: prior.reviewFingerprint });
    expect(await screenplay()).toEqual(before);
    await expect(service.reviewFdxUpdate({ ...input, sourceSha256: hash(original) })).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_SOURCE_CHANGED' });
  });

  it('rejects a changed source and a concurrent explicit import before writing', async () => {
    const candidate = await review(fdx(scene('A', 'Wait!')));
    const before = await screenplay();
    await fs.writeFile(exportPath, fdx(scene('A', 'Go!')));
    await expect(service.applyFdxUpdate({ ...input, reviewFingerprint: candidate.reviewFingerprint })).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_UPDATE_REVIEW_STALE' });
    expect(await screenplay()).toEqual(before);
    await fs.writeFile(sourcePath, fdx(scene('B', 'New baseline.')));
    await service.importFdxScreenplay({ ...input, sourcePath });
    await fs.writeFile(exportPath, fdx(scene('A', 'Wait!')));
    await expect(service.applyFdxUpdate({ ...input, reviewFingerprint: candidate.reviewFingerprint })).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_UPDATE_REVIEW_STALE' });
  });

  it('binds actual downstream metadata from a separate connection and keeps weak history', async () => {
    const before = await screenplay();
    const sceneId = before.screenplay.scenes[0]!.id;
    const database = new Database(path.join(projectFolder, '.renku/project.sqlite'));
    const now = new Date().toISOString();
    database.prepare('INSERT INTO scene_beats_revision (id, scene_id, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('beats_one', sceneId, 'opaque, not parsed', now, now);
    database.prepare('INSERT INTO scene_beats_state (scene_id, active_revision_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(sceneId, 'beats_one', now, now);
    database.prepare('INSERT INTO shot_plan (id, scene_id, number, title, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)').run('plan_one', sceneId, 'Plan', now, now);
    database.prepare('INSERT INTO shot_plan (id, scene_id, number, title, created_at, updated_at, discarded_at) VALUES (?, ?, 2, ?, ?, ?, ?)').run('plan_discarded', sceneId, 'Old plan', now, now, now);
    const insertShot = database.prepare('INSERT INTO shot (id, shot_plan_id, position, number, title, description, brief, created_at, updated_at, discarded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insertShot.run('shot_live', 'plan_one', 0, '1', 'Shot', 'opaque', 'opaque', now, now, null);
    insertShot.run('shot_discarded', 'plan_one', 1, '2', 'Shot', 'opaque', 'opaque', now, now, now);
    insertShot.run('shot_old_plan', 'plan_discarded', 0, '1', 'Shot', 'opaque', 'opaque', now, now, null);
    database.prepare('INSERT INTO asset (id, type, media_kind, title, origin, availability, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('asset_audio', 'shot_plan_dialogue_audio', 'audio', 'Dialogue', 'generated', 'ready', now, now);
    database.prepare('INSERT INTO asset_file (id, asset_id, role, project_relative_path, mime_type, media_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('file_audio', 'asset_audio', 'primary', 'audio/dialogue.mp3', 'audio/mpeg', 'audio', now, now);
    // Real audio ownership rows: media bytes/turn labels are deliberately irrelevant to impact.
    database.prepare('INSERT INTO shot_plan_dialogue_audio_take (id, shot_plan_id, asset_id, asset_file_id, turn_start_number, turn_end_number, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?)').run('take_one', 'plan_one', 'asset_audio', 'file_audio', now, now);
    const candidate = await review(fdx(scene('A', 'Wait!') + scene('B')));
    expect(candidate.removedOrReplacedScenes[0]).toMatchObject({ activeSceneBeats: true, sceneBeatsRevisionCount: 1, shotPlanCount: 1, shotCount: 1, dialogueAudioTakeCount: 1 });
    database.prepare('UPDATE shot_plan_dialogue_audio_take SET discarded_at = ? WHERE id = ?').run(now, 'take_one');
    const discardedAudio = await service.reviewFdxUpdate({ ...input, sourceSha256: candidate.sourceSha256 });
    expect(discardedAudio.removedOrReplacedScenes[0]!.dialogueAudioTakeCount).toBe(0);
    database.prepare('UPDATE shot_plan_dialogue_audio_take SET discarded_at = NULL WHERE id = ?').run('take_one');
    database.prepare('UPDATE shot_plan SET updated_at = ? WHERE id = ?').run('2099-01-01', 'plan_one');
    await expect(service.applyFdxUpdate({ ...input, reviewFingerprint: candidate.reviewFingerprint })).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_UPDATE_REVIEW_STALE' });
    expect(await screenplay()).toEqual(before);
    const latest = await service.reviewFdxUpdate({ ...input, sourceSha256: candidate.sourceSha256 });
    await service.applyFdxUpdate({ ...input, reviewFingerprint: latest.reviewFingerprint });
    expect(database.prepare('SELECT scene_id FROM shot_plan WHERE id = ?').get('plan_one')).toEqual({ scene_id: sceneId });
    expect(database.prepare('SELECT id FROM scene WHERE id = ?').get(sceneId)).toBeUndefined();
    database.close();
  });

  it('observes rename-over, deletion/recreation and same-metadata saves', async () => {
    await fs.writeFile(exportPath, original);
    const stat = await fs.stat(exportPath);
    const changed = original.replace('Wait.', 'Wait!');
    await fs.writeFile(exportPath, changed);
    await fs.utimes(exportPath, stat.atime, stat.mtime);
    expect(await service.readFdxUpdateStatus(input)).toMatchObject({ state: 'pending', sourceSha256: hash(changed) });
    const temporary = `${exportPath}.tmp`;
    await fs.writeFile(temporary, original);
    await fs.rename(temporary, exportPath);
    expect(await service.readFdxUpdateStatus(input)).toMatchObject({ state: 'current' });
    await fs.unlink(exportPath);
    expect(await service.readFdxUpdateStatus(input)).toMatchObject({ state: 'missing' });
    await fs.writeFile(exportPath, changed);
    expect(await service.readFdxUpdateStatus(input)).toMatchObject({ state: 'pending' });
  });

  it.each(['empty', 'malformed', 'utf8', 'oversize', 'symlink', 'directory', 'hardlink'] as const)('cannot apply a %s export or change accepted state', async (kind) => {
    const candidate = await review(fdx(scene('A', 'Wait!')));
    const before = await screenplay();
    await fs.unlink(exportPath);
    if (kind === 'empty') await fs.writeFile(exportPath, '');
    if (kind === 'malformed') await fs.writeFile(exportPath, '<FinalDraft>');
    if (kind === 'utf8') await fs.writeFile(exportPath, Buffer.from([0xff]));
    if (kind === 'oversize') await fs.writeFile(exportPath, Buffer.alloc(10 * 1024 * 1024 + 1));
    if (kind === 'symlink') await fs.symlink(sourcePath, exportPath);
    if (kind === 'directory') await fs.mkdir(exportPath);
    if (kind === 'hardlink') {
      const assets = await service.listAssets({ ...input, owner: { kind: 'project' } });
      const retained = assets.find((asset) => asset.type === 'screenplay_source')!.files[0]!;
      await fs.link(path.join(projectFolder, retained.projectRelativePath), exportPath);
    }
    await expect(service.applyFdxUpdate({ ...input, reviewFingerprint: candidate.reviewFingerprint })).rejects.toBeDefined();
    expect(await screenplay()).toEqual(before);
  });

  it('rejects a symlinked handoff directory and a folder creation failure', async () => {
    await fs.rmdir(path.dirname(exportPath));
    const outside = path.join(input.homeDir, 'outside');
    await fs.mkdir(outside);
    await fs.symlink(outside, path.dirname(exportPath));
    expect(await service.readFdxUpdateStatus(input)).toMatchObject({ state: 'unavailable', diagnostics: [{ code: 'SCREENPLAY_FDX_EXPORT_PATH_INVALID' }] });
    await expect(service.prepareFdxExportFolder(input)).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_EXPORT_PATH_INVALID' });
    await fs.unlink(path.dirname(exportPath));
    const parent = path.dirname(path.dirname(exportPath));
    await fs.chmod(parent, 0o500);
    try {
      await expect(service.prepareFdxExportFolder(input)).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_SOURCE_UNREADABLE' });
    } finally { await fs.chmod(parent, 0o700); }
  });

  it('rejects a revision change made through a separate connection', async () => {
    const candidate = await review(fdx(scene('A', 'Wait!')));
    const before = await screenplay();
    const database = new Database(path.join(projectFolder, '.renku/project.sqlite'));
    database.prepare('UPDATE screenplay_revision SET created_at = ?').run('2099-01-01T00:00:00.000Z');
    database.close();
    await expect(service.applyFdxUpdate({ ...input, reviewFingerprint: candidate.reviewFingerprint })).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_UPDATE_REVIEW_STALE' });
    expect(await screenplay()).toEqual(before);
  });

  it('returns settling when valid XML changes between the two reads', async () => {
    await fs.writeFile(exportPath, fdx(scene('A', 'Wait!')));
    const pending = service.readFdxUpdateStatus(input);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await fs.writeFile(exportPath, fdx(scene('A', 'Go!')));
    expect(await pending).toMatchObject({ state: 'settling' });
  });
});
