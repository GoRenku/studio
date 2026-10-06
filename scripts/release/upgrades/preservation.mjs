import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { coreRoot, sha256File } from './fixtures.mjs';

export function observeProject(product, projectFolder, databasePath = path.join(projectFolder, '.renku/project.sqlite')) {
  const require = createRequire(path.join(coreRoot(product), 'package.json'));
  const Database = require('better-sqlite3');
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  const tables = {};
  try {
    assert.equal(db.pragma('quick_check', { simple: true }), 'ok');
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    for (const { name } of db.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name").all()) {
      tables[name] = db.prepare(`select * from "${name}"`).all();
    }
    const files = {};
    const visit = (folder) => {
      for (const name of readdirSync(folder).sort()) {
        const file = path.join(folder, name);
        const relative = path.relative(projectFolder, file).split(path.sep).join('/');
        if (relative.startsWith('.renku/project-database-backups') || /^\.renku\/project\.sqlite(?:-(?:wal|shm|journal))?$/.test(relative)) { continue; }
        if (statSync(file).isDirectory()) { visit(file); }
        else { files[relative] = sha256File(file); }
      }
    };
    visit(projectFolder);
    return { generation: db.pragma('user_version', { simple: true }), tables, files };
  } finally { db.close(); }
}
export function assertJournalComplete(product, observation) {
  const migrations = path.join(coreRoot(product), 'drizzle');
  const journal = JSON.parse(readFileSync(path.join(migrations, 'meta/_journal.json'), 'utf8'));
  const rows = observation.tables.__drizzle_migrations;
  assert.equal(rows.length, journal.entries.length, 'Drizzle journal is incomplete');
  for (const entry of journal.entries) {
    const hash = createHash('sha256').update(readFileSync(path.join(migrations, `${entry.tag}.sql`), 'utf8')).digest('hex');
    assert.ok(rows.some((row) => row.hash === hash && row.created_at === entry.when), `Incomplete journal entry ${entry.tag}`);
  }
}
const ordered = (rows) => rows.map((row) => JSON.stringify(row)).sort();
function currentSettings(document) {
  const settings = JSON.parse(document);
  if (settings.version === 2) {
    const original = settings.generation;
    const media = (provider, preferences) => ({ provider,
      askBeforeGenerating: preferences.requirePerRunConfirmation,
      runGenerationsConcurrently: preferences.allowConcurrentGenerations,
      maxConcurrentGenerations: preferences.maxConcurrentGenerations });
    settings.generation = { displayPreview: original.displayPreview,
      image: media(original.preferCodexImageGeneration ? 'codex' : 'fal-ai', original.preferCodexImageGeneration ? original.codexBuiltIn : original.renkuManaged),
      video: media('fal-ai', original.renkuManaged), audio: media('elevenlabs', original.renkuManaged) };
  }
  if (settings.version < 5) { settings.generation.enableProviderPromptExpansion = true; }
  settings.version = 6;
  return settings;
}
export function assertPreserved(before, after) {
  assert.deepEqual(after.files, before.files, 'Opaque Project file bytes changed');
  const parents = new Map((before.tables.asset ?? []).map((parent) => [parent.id, parent]));
  const fileIds = new Map((before.tables.asset_file ?? []).map((file) => [file.asset_id, file.id]));
  const membership = new Map((before.tables.asset_membership ?? []).map((row) => [row.asset_id, row.owner_key]));
  const removedTables = new Set(['asset', 'asset_membership', 'selected_asset', 'asset_file_generation', 'media_generation_spec', 'media_generation_run', 'media_generation_run_attempt']);
  for (const table of ['asset_file_generation', 'media_generation_spec', 'media_generation_run', 'media_generation_run_attempt']) {
    assert.equal(before.tables[table]?.length ?? 0, 0, `The recipe lacks populated provenance conversion expectations for ${table}`);
  }
  for (const table of ['cast_voice_provider_registration', 'scene_dialogue_audio_take_selection']) {
    if (before.tables[table] && !after.tables[table]) {
      assert.equal(before.tables[table].length, 0, `Missing explicit populated conversion expectation for ${table}`);
      removedTables.add(table);
    }
  }
  if (before.generation < 67) {
    const takes = before.tables.scene_dialogue_audio_take;
    assert.equal(takes.length, 1, 'The earlier dialogue conversion recipe is incomplete');
    const take = takes[0];
    assert.equal(take.id, 'scene_dialogue_audio_take_x9j47jps');
    const converted = after.tables.shot_plan_dialogue_audio_take.find(({ id }) => id === take.id);
    assert.deepEqual(converted, { id: take.id, shot_plan_id: 'shot_plan_bm34r9be', asset_file_id: take.asset_file_id,
      turn_start_number: 1, turn_end_number: 1, selected_at: null, created_at: take.created_at,
      updated_at: take.updated_at, discarded_at: take.discarded_at, discard_operation_id: take.discard_operation_id, restored_at: take.restored_at });
    assert.equal(before.tables.scene_dialogue_audio.length, 1);
    assert.equal(take.scene_dialogue_audio_id, before.tables.scene_dialogue_audio[0].id);
    // ADR 0090 retires the old editable request state; the accepted SQL maps the retained Take and file.
    removedTables.add('scene_dialogue_audio');
    removedTables.add('scene_dialogue_audio_take');
  }
  for (const [table, rows] of Object.entries(before.tables)) {
    if (table === '__drizzle_migrations' || removedTables.has(table)) { continue; }
    assert.ok(after.tables[table], `Table disappeared without a preservation rule: ${table}`);
    const expected = rows.map((source) => {
      const row = { ...source };
      if (table === 'project_settings') {
        const actual = after.tables[table].find((candidate) => candidate.singleton_id === row.singleton_id);
        assert.deepEqual(JSON.parse(actual.document), currentSettings(row.document), 'Effective Project Settings changed');
        row.document = actual.document;
      }
      if (table === 'asset_file' && source.asset_id) {
        const parent = parents.get(source.asset_id);
        assert.ok(parent && membership.has(source.asset_id), 'Unmapped file owner');
        delete row.asset_id;
        delete row.role;
        delete row.source_generation_spec_id;
        for (const [key, value] of Object.entries(parent)) {
          if (key !== 'id' && key !== 'media_kind') { row[key] = value; }
        }
        row.owner_key = membership.get(source.asset_id);
        if (source.asset_id === 'asset_86j7tf8v' && before.generation < 67) {
          row.type = 'shot_plan_dialogue_audio';
          row.authored_from_shot_plan_id = 'shot_plan_bm34r9be';
        }
      }
      if (table === 'cast_voice' && row.sample_asset_id) {
        row.sample_asset_file_id = fileIds.get(row.sample_asset_id);
        delete row.sample_asset_id;
      }
      if (table === 'cast_voice' && 'sample_source_kind' in row) {
        assert.equal(row.sample_source_kind, 'custom_file');
        for (const key of ['sample_id', 'sample_fetched_at', 'sample_api_base_url']) { assert.equal(row[key], null); }
        for (const key of ['sample_source_kind', 'sample_id', 'sample_fetched_at', 'sample_api_base_url']) { delete row[key]; }
        row.voice_identity = null;
        assert.ok(after.tables.cast_voice_default.some((selection) => selection.cast_member_id === row.cast_member_id
          && selection.cast_voice_id === row.id && selection.created_at === row.created_at && selection.updated_at === row.updated_at), 'Default voice conversion changed');
      }
      if (['lookbook_image', 'lookbook_sheet', 'shot_plan_previs_revision'].includes(table) && row.asset_id) {
        row.asset_file_id = fileIds.get(row.asset_id);
        delete row.asset_id;
      }
      if (['shot_plan_clip_take', 'shot_plan_dialogue_audio_take', 'screenplay_import'].includes(table)) {
        delete row.asset_id;
        delete row.source_asset_id;
      }
      if (table === 'project' && 'asset_file_backfill_version' in row) { row.asset_file_backfill_version = 1; }
      if (table === 'trash_item' && row.item_kind === 'asset') {
        row.item_kind = 'assetFile';
        row.item_id = fileIds.get(source.item_id);
        const snapshot = JSON.parse(row.restore_snapshot_json);
        const { assetId, ...retained } = snapshot;
        row.restore_snapshot_json = JSON.stringify({ ...retained, assetFileId: fileIds.get(assetId) });
      }
      if (table === 'trash_item' && before.generation < 71 && row.item_kind !== 'assetFile') {
        const snapshot = JSON.parse(row.restore_snapshot_json);
        if (['lookbookImage', 'lookbookSheet', 'shotPlanDialogueAudioTake'].includes(row.item_kind)) {
          snapshot.assetFileId = fileIds.get(snapshot.assetId); delete snapshot.assetId;
        }
        if (row.item_kind === 'castVoice') { snapshot.sampleAssetFileId = fileIds.get(snapshot.sampleAssetId); delete snapshot.sampleAssetId; }
        const convertImages = (images) => { images.assetFileIds = images.assetIds.map((id) => fileIds.get(id)); delete images.assetIds; };
        if (row.item_kind === 'shot') { convertImages(snapshot.images); }
        if (row.item_kind === 'shotPlan') { snapshot.shots.forEach((shot) => convertImages(shot.images)); }
        row.restore_snapshot_json = JSON.stringify(snapshot);
        if (row.item_kind === 'inspirationImage') {
          const reference = after.tables.asset_file.find((file) => file.project_relative_path === row.original_project_relative_path);
          assert.ok(reference, 'Historical Inspiration identity disappeared');
          assert.equal(reference.owner_key, `inspirationFolder:${row.owner_id}`);
          assert.equal(reference.discarded_at, row.created_at);
          row.item_kind = 'assetFile'; row.item_id = reference.id; row.title = '';
          row.restore_snapshot_json = JSON.stringify({ assetFileId: reference.id });
        }
      }
      return row;
    });
    const actual = expected.map((row) => {
      const matches = after.tables[table].filter((candidate) => Object.entries(row).every(([key, value]) => candidate[key] === value));
      // SQL json_remove/json_set may change key order without changing the authored creative fields.
      if (table === 'trash_item') {
        const match = after.tables[table].find((candidate) => candidate.id === row.id);
        assert.ok(match, 'Trash identity disappeared');
        assert.deepEqual(JSON.parse(match.restore_snapshot_json), JSON.parse(row.restore_snapshot_json));
        return { ...Object.fromEntries(Object.keys(row).map((key) => [key, match[key]])), restore_snapshot_json: row.restore_snapshot_json };
      }
      assert.equal(matches.length, 1, `Lost or duplicated preserved row in ${table}: ${JSON.stringify(row)}`);
      return Object.fromEntries(Object.keys(row).map((key) => [key, matches[0][key]]));
    });
    assert.deepEqual(ordered(actual), ordered(expected), `Preservation failed in ${table}`);
  }
  for (const selection of before.tables.selected_asset ?? []) {
    assert.ok(after.tables.selected_asset_file.some((row) => row.target_key === selection.target_key
      && row.asset_file_id === fileIds.get(selection.asset_id) && row.created_at === selection.created_at && row.updated_at === selection.updated_at), 'Selection changed');
  }
  assert.equal(after.tables.project[0].asset_file_backfill_version, 1, 'Reference registration remains pending');
}
