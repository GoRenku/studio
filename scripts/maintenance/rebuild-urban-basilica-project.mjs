#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptFolder = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptFolder, '../..');
const coreRequire = createRequire(path.join(repositoryRoot, 'packages/core/package.json'));
const Database = coreRequire('better-sqlite3');
const TOKEN_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const EXPECTED_BACKUP_SHA256 = 'ce71a147d01f4faf28e17ca306f2ec875d42b9caeedafd935e8d18f81c9c98e4';
const EXPECTED_COUNTS = {
  scenes: 10,
  sceneBeatsRevisions: 12,
  activeSceneBeatsPointers: 4,
  shotPlans: 1,
  shots: 1,
  activeAssets: 86,
  activeAssetFiles: 94,
};

const options = parseArguments(process.argv.slice(2));
await main(options);

async function main(input) {
  assertAbsoluteSafePath(input.sourceRoot, 'source root');
  assertAbsoluteSafePath(input.archiveRoot, 'archive root');
  assertAbsoluteSafePath(input.destinationRoot, 'destination root');
  assertAbsoluteSafePath(input.databaseBackup, 'database backup');
  assertAbsoluteSafePath(input.manifest, 'manifest');
  if (path.basename(input.sourceRoot) !== 'renku-movies') {
    fail('REBUILD_SOURCE_ROOT_INVALID', 'Source root must be the explicit renku-movies directory.');
  }
  if (path.basename(input.destinationRoot) !== 'renku-movies') {
    fail('REBUILD_DESTINATION_ROOT_INVALID', 'Destination root must end in renku-movies.');
  }
  if (fs.existsSync(input.archiveRoot)) {
    fail('REBUILD_ARCHIVE_EXISTS', `Archive target already exists: ${input.archiveRoot}`);
  }
  const sourceProject = path.join(input.sourceRoot, 'urban-basilica');
  assertInside(input.sourceRoot, sourceProject, 'source Project');
  if (!fs.existsSync(sourceProject) || !fs.statSync(sourceProject).isDirectory()) {
    fail('REBUILD_SOURCE_PROJECT_MISSING', `Source Project was not found: ${sourceProject}`);
  }
  if (!fs.existsSync(input.databaseBackup)) {
    fail('REBUILD_DATABASE_BACKUP_MISSING', `Database backup was not found: ${input.databaseBackup}`);
  }
  assertInside(sourceProject, input.databaseBackup, 'generation-60 database backup');

  const plan = await createRebuildManifest({ ...input, sourceProject });
  await writeJson(input.manifest, plan);
  if (!input.apply && !input.rehearse) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  const destinationReusesArchivedSource = input.apply
    && path.resolve(input.destinationRoot) === path.resolve(input.sourceRoot);
  if (fs.existsSync(input.destinationRoot) && !destinationReusesArchivedSource) {
    fail('REBUILD_DESTINATION_EXISTS', `Destination root already exists: ${input.destinationRoot}`);
  }
  if (input.apply && input.confirmation !== 'MOVE RENKU MOVIES ROOT') {
    fail(
      'REBUILD_LIVE_CONFIRMATION_REQUIRED',
      'Live apply requires --confirmation "MOVE RENKU MOVIES ROOT" after the separate user confirmation.'
    );
  }
  const result = await applyRebuild(plan, input);
  await writeJson(input.manifest, result);
  await writeJson(path.join(input.destinationRoot, 'urban-basilica', '.renku', 'rebuild-manifest.json'), result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function createRebuildManifest(input) {
  const backupHash = await hashFile(input.databaseBackup);
  const backupStats = await fsp.stat(input.databaseBackup);
  if (backupHash !== EXPECTED_BACKUP_SHA256) {
    fail('REBUILD_DATABASE_BACKUP_HASH_MISMATCH', `Unexpected generation-60 backup hash: ${backupHash}`);
  }
  const db = new Database(input.databaseBackup, { readonly: true, fileMustExist: true });
  try {
    const generation = db.pragma('user_version', { simple: true });
    const quickCheck = db.pragma('quick_check').map((row) => Object.values(row)[0]);
    const foreignKeyCheck = db.pragma('foreign_key_check');
    if (generation !== 60 || quickCheck.join(',') !== 'ok' || foreignKeyCheck.length > 0) {
      fail('REBUILD_DATABASE_INTEGRITY_INVALID', 'Generation-60 backup failed generation or integrity checks.');
    }
    const counts = sourceCounts(db);
    assertExpectedCounts(counts);
    const context = readStorageContext(db);
    const retainedFiles = selectRetainedAssetFiles(db);
    if (retainedFiles.length !== EXPECTED_COUNTS.activeAssets) {
      fail('REBUILD_RETAINED_FILE_COUNT_INVALID', `Expected 86 retained files, found ${retainedFiles.length}.`);
    }
    const allocatedPaths = new Set();
    const retained = [];
    const diagnostics = [];
    for (const row of retainedFiles) {
      const sourceAbsolutePath = path.join(input.sourceProject, row.project_relative_path);
      assertInside(input.sourceProject, sourceAbsolutePath, `Asset File ${row.file_id}`);
      if (!fs.existsSync(sourceAbsolutePath) || !fs.statSync(sourceAbsolutePath).isFile()) {
        diagnostics.push({ code: 'REBUILD_RETAINED_FILE_MISSING', fileId: row.file_id, path: row.project_relative_path });
        continue;
      }
      const stats = await fsp.stat(sourceAbsolutePath);
      const sha256 = await hashFile(sourceAbsolutePath);
      const storedHash = normalizeStoredHash(row.content_hash);
      if (row.size_bytes !== null && row.size_bytes !== stats.size) {
        diagnostics.push({ code: 'REBUILD_RETAINED_FILE_SIZE_MISMATCH', fileId: row.file_id, stored: row.size_bytes, actual: stats.size });
      }
      if (storedHash && storedHash !== sha256) {
        diagnostics.push({ code: 'REBUILD_RETAINED_FILE_HASH_MISMATCH', fileId: row.file_id, stored: storedHash, actual: sha256 });
      }
      const newPath = allocateDestinationPath(row, context, allocatedPaths);
      retained.push({
        assetId: row.asset_id,
        assetFileId: row.file_id,
        assetType: row.type,
        origin: row.origin,
        mediaKind: row.media_kind,
        oldPath: row.project_relative_path,
        newPath,
        sizeBytes: stats.size,
        sha256,
      });
    }
    if (diagnostics.length > 0) {
      fail('REBUILD_PREFLIGHT_FAILED', JSON.stringify(diagnostics, null, 2));
    }
    const omittedFiles = db.prepare(`
      SELECT af.id AS assetFileId, af.asset_id AS assetId, af.role, af.project_relative_path AS oldPath
      FROM asset_file af
      JOIN asset a ON a.id = af.asset_id
      WHERE a.discarded_at IS NULL AND af.discarded_at IS NULL
        AND af.id NOT IN (${placeholders(retained.map((row) => row.assetFileId))})
      ORDER BY af.id
    `).all(...retained.map((row) => row.assetFileId));
    const userFiles = await inventoryUserFolders(input.sourceProject);
    const sourceTreeFiles = await inventoryTree(input.sourceRoot);
    const copiedSourcePaths = new Set([
      ...retained.map((row) => path.posix.join('urban-basilica', row.oldPath)),
      ...userFiles.map((row) => path.posix.join('urban-basilica', row.path)),
    ]);
    const databaseSourcePath = path.relative(input.sourceRoot, input.databaseBackup)
      .split(path.sep).join('/');
    const omittedSourceFiles = sourceTreeFiles.filter(
      (row) => !copiedSourcePaths.has(row.path)
    ).map((row) => ({
      ...row,
      disposition: row.path === databaseSourcePath
        ? 'copied-as-project-database'
        : 'omitted-from-reconstructed-root',
    }));
    const retainedGeneration = retainedGenerationIds(db, retained.map((row) => row.assetFileId));
    const activeBeatRevisionIds = db.prepare(
      'SELECT active_beat_sheet_id AS id FROM scene_beat_sheet_state WHERE active_beat_sheet_id IS NOT NULL ORDER BY scene_id'
    ).all().map((row) => row.id);
    const allBeatRevisionIds = db.prepare('SELECT id FROM scene_beat_sheet ORDER BY id').all().map((row) => row.id);
    return {
      version: 1,
      mode: 'planned',
      createdAt: new Date().toISOString(),
      sourceRoot: input.sourceRoot,
      sourceProject: input.sourceProject,
      archiveRoot: input.archiveRoot,
      destinationRoot: input.destinationRoot,
      generation60DatabasePath: input.databaseBackup,
      database: {
        sourceGeneration: generation,
        sourceSizeBytes: backupStats.size,
        sourceSha256: backupHash,
        quickCheck,
        foreignKeyCheck,
      },
      sourceCounts: counts,
      retainedFiles: retained,
      omittedFiles,
      discardedRows: discardedRowIds(db),
      generationHistory: retainedGeneration,
      sceneBeatsHistory: {
        retainedRevisionIds: activeBeatRevisionIds,
        removedRevisionIds: allBeatRevisionIds.filter((id) => !activeBeatRevisionIds.includes(id)),
      },
      userFiles,
      sourceTreeEvidence: summarizeTree(sourceTreeFiles),
      omittedSourceFiles,
      diagnostics,
      plannedByteTotal: retained.reduce((total, row) => total + row.sizeBytes, 0) +
        userFiles.reduce((total, row) => total + row.sizeBytes, 0),
    };
  } finally {
    db.close();
  }
}

async function applyRebuild(plan, input) {
  let fileSourceProject = plan.sourceProject;
  let backupSource = plan.generation60DatabasePath;
  let liveMoved = false;
  try {
    if (input.apply) {
      const relativeBackup = path.relative(plan.sourceRoot, plan.generation60DatabasePath);
      await fsp.rename(plan.sourceRoot, plan.archiveRoot);
      liveMoved = true;
      fileSourceProject = path.join(plan.archiveRoot, 'urban-basilica');
      backupSource = path.join(plan.archiveRoot, relativeBackup);
    }
    const destinationProject = path.join(plan.destinationRoot, 'urban-basilica');
    await fsp.mkdir(path.join(destinationProject, '.renku'), { recursive: true });
    const destinationDatabase = path.join(destinationProject, '.renku', 'project.sqlite');
    await copyExclusive(backupSource, destinationDatabase);
    const copiedBackupHash = await hashFile(destinationDatabase);
    if (copiedBackupHash !== plan.database.sourceSha256) {
      fail('REBUILD_DATABASE_COPY_HASH_MISMATCH', 'Copied database does not match the generation-60 backup.');
    }
    const { migrateProjectDatabase } = await import(
      '../../packages/core/dist/server/database/lifecycle/migrator.js'
    );
    const migration = migrateProjectDatabase(destinationDatabase);
    cleanupMigratedDatabase(destinationDatabase, plan);
    for (const retained of plan.retainedFiles) {
      const source = path.join(fileSourceProject, retained.oldPath);
      const destination = path.join(destinationProject, retained.newPath);
      assertInside(fileSourceProject, source, retained.assetFileId);
      assertInside(destinationProject, destination, retained.assetFileId);
      await copyExclusive(source, destination);
      await verifyCopiedFile(destination, retained);
    }
    for (const userFile of plan.userFiles) {
      const source = path.join(fileSourceProject, userFile.path);
      const destination = path.join(destinationProject, userFile.path);
      await copyExclusive(source, destination);
      await verifyCopiedFile(destination, userFile);
    }
    updateAssetFilePaths(destinationDatabase, plan.retainedFiles);
    const finalDatabase = inspectFinalDatabase(destinationDatabase, plan.sourceCounts);
    return {
      ...plan,
      mode: input.apply ? 'live-complete' : 'rehearsal-complete',
      completedAt: new Date().toISOString(),
      copiedPreMigrationSha256: copiedBackupHash,
      preMigrationBackup: migration.preMigrationBackup,
      destinationProject,
      finalDatabase,
      archiveEvidence: await verifySourceTreeUnchanged(
        input.apply ? plan.archiveRoot : plan.sourceRoot,
        plan.sourceTreeEvidence,
        input.apply
      ),
    };
  } catch (error) {
    if (liveMoved && fs.existsSync(plan.destinationRoot)) {
      const failedRoot = `${plan.destinationRoot}-failed-rebuild-${timestamp()}`;
      if (!fs.existsSync(failedRoot)) {
        await fsp.rename(plan.destinationRoot, failedRoot);
      }
    }
    throw error;
  }
}

function cleanupMigratedDatabase(databasePath, plan) {
  const db = new Database(databasePath);
  try {
    db.pragma('foreign_keys = ON');
    const retainedFileIds = plan.retainedFiles.map((row) => row.assetFileId);
    const retainedAssetIds = plan.retainedFiles.map((row) => row.assetId);
    const retainedBeatIds = plan.sceneBeatsHistory.retainedRevisionIds;
    const retainedRunIds = plan.generationHistory.retainedRunIds;
    const retainedSpecIds = plan.generationHistory.retainedSpecIds;
    db.transaction(() => {
      db.prepare(`DELETE FROM scene_beats_revision WHERE id NOT IN (${placeholders(retainedBeatIds)})`).run(...retainedBeatIds);
      db.prepare(`UPDATE scene_beats_revision SET document = json_remove(document, '$.baseRevisionId')`).run();
      db.prepare(`DELETE FROM scene_dialogue_audio_take WHERE asset_file_id NOT IN (${placeholders(retainedFileIds)})`).run(...retainedFileIds);
      db.prepare(`DELETE FROM lookbook_image WHERE asset_id NOT IN (${placeholders(retainedAssetIds)})`).run(...retainedAssetIds);
      db.prepare(`DELETE FROM lookbook_sheet WHERE asset_id NOT IN (${placeholders(retainedAssetIds)})`).run(...retainedAssetIds);
      db.prepare(`DELETE FROM selected_asset WHERE asset_id NOT IN (${placeholders(retainedAssetIds)})`).run(...retainedAssetIds);
      db.prepare(`DELETE FROM asset_membership WHERE asset_id NOT IN (${placeholders(retainedAssetIds)})`).run(...retainedAssetIds);
      db.prepare(`DELETE FROM asset_file_generation WHERE asset_file_id NOT IN (${placeholders(retainedFileIds)})`).run(...retainedFileIds);
      db.prepare(`DELETE FROM asset_file WHERE id NOT IN (${placeholders(retainedFileIds)})`).run(...retainedFileIds);
      db.prepare(`DELETE FROM cast_voice_provider_registration WHERE cast_voice_id IN (SELECT id FROM cast_voice WHERE sample_asset_id NOT IN (${placeholders(retainedAssetIds)}))`).run(...retainedAssetIds);
      db.prepare(`DELETE FROM cast_voice WHERE sample_asset_id NOT IN (${placeholders(retainedAssetIds)})`).run(...retainedAssetIds);
      db.prepare(`DELETE FROM asset WHERE id NOT IN (${placeholders(retainedAssetIds)})`).run(...retainedAssetIds);
      db.prepare('DELETE FROM trash_item').run();
      db.prepare('DELETE FROM trash_operation').run();
      db.prepare(`DELETE FROM media_generation_run WHERE id NOT IN (${placeholders(retainedRunIds)})`).run(...retainedRunIds);
      db.prepare(`DELETE FROM media_generation_spec WHERE id NOT IN (${placeholders(retainedSpecIds)})`).run(...retainedSpecIds);
    })();
  } finally {
    db.close();
  }
}

function updateAssetFilePaths(databasePath, retainedFiles) {
  const db = new Database(databasePath);
  try {
    db.transaction(() => {
      const update = db.prepare('UPDATE asset_file SET project_relative_path = ?, updated_at = ? WHERE id = ?');
      const now = new Date().toISOString();
      for (const row of retainedFiles) {
        const result = update.run(row.newPath, now, row.assetFileId);
        if (result.changes !== 1) fail('REBUILD_ASSET_FILE_UPDATE_FAILED', `Asset File was not updated: ${row.assetFileId}`);
      }
    })();
  } finally {
    db.close();
  }
}

function inspectFinalDatabase(databasePath, sourceCounts) {
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const result = {
      generation: db.pragma('user_version', { simple: true }),
      sha256: hashFileSync(databasePath),
      sizeBytes: fs.statSync(databasePath).size,
      quickCheck: db.pragma('quick_check').map((row) => Object.values(row)[0]),
      foreignKeyCheck: db.pragma('foreign_key_check'),
      counts: {
        assets: scalar(db, 'SELECT count(*) FROM asset'),
        assetFiles: scalar(db, 'SELECT count(*) FROM asset_file'),
        sceneBeatsRevisions: scalar(db, 'SELECT count(*) FROM scene_beats_revision'),
        screenplayStructureEntries: scalar(db, 'SELECT count(*) FROM screenplay_structure_entry'),
        screenplayReferences: scalar(db, 'SELECT count(*) FROM screenplay_reference'),
        storyboardAssets: scalar(db, "SELECT count(*) FROM asset WHERE type = 'scene_storyboard_image'"),
        trashItems: scalar(db, 'SELECT count(*) FROM trash_item'),
      },
    };
    if (result.generation !== 61 || result.quickCheck.join(',') !== 'ok' || result.foreignKeyCheck.length > 0) {
      fail('REBUILD_FINAL_DATABASE_INVALID', JSON.stringify(result, null, 2));
    }
    if (result.counts.assets !== 86 || result.counts.assetFiles !== 86 || result.counts.sceneBeatsRevisions !== 4 || result.counts.storyboardAssets !== 37) {
      fail('REBUILD_FINAL_COUNTS_INVALID', JSON.stringify(result.counts));
    }
    if (result.counts.screenplayStructureEntries !== sourceCounts.screenplayStructureEntries ||
        result.counts.screenplayReferences !== sourceCounts.screenplayReferences) {
      fail('REBUILD_SCREENPLAY_ROWS_LOST', JSON.stringify(result.counts));
    }
    return result;
  } finally {
    db.close();
  }
}

function sourceCounts(db) {
  return {
    scenes: scalar(db, 'SELECT count(*) FROM scene'),
    sceneBeatsRevisions: scalar(db, 'SELECT count(*) FROM scene_beat_sheet'),
    activeSceneBeatsPointers: scalar(db, 'SELECT count(*) FROM scene_beat_sheet_state WHERE active_beat_sheet_id IS NOT NULL'),
    shotPlans: scalar(db, 'SELECT count(*) FROM shot_plan WHERE discarded_at IS NULL'),
    shots: scalar(db, 'SELECT count(*) FROM shot WHERE discarded_at IS NULL'),
    activeAssets: scalar(db, 'SELECT count(*) FROM asset WHERE discarded_at IS NULL'),
    activeAssetFiles: scalar(db, 'SELECT count(*) FROM asset_file af JOIN asset a ON a.id=af.asset_id WHERE a.discarded_at IS NULL AND af.discarded_at IS NULL'),
    screenplayStructureEntries: scalar(db, 'SELECT count(*) FROM screenplay_structure_entry'),
    screenplayReferences: scalar(db, 'SELECT count(*) FROM screenplay_reference'),
  };
}

function assertExpectedCounts(actual) {
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (actual[key] !== expected) fail('REBUILD_SOURCE_COUNT_MISMATCH', `${key}: expected ${expected}, found ${actual[key]}`);
  }
}

function selectRetainedAssetFiles(db) {
  const rows = db.prepare(`
    SELECT a.id AS asset_id, a.type, a.title, a.origin, a.reference_name,
      am.owner_key, af.id AS file_id, af.role, af.project_relative_path,
      af.media_kind, af.size_bytes, af.content_hash, af.source_generation_spec_id
    FROM asset a
    JOIN asset_membership am ON am.asset_id = a.id
    JOIN asset_file af ON af.asset_id = a.id
    WHERE a.discarded_at IS NULL AND af.discarded_at IS NULL
    ORDER BY a.id, af.created_at, af.id
  `).all();
  const byAsset = new Map();
  for (const row of rows) {
    const values = byAsset.get(row.asset_id) ?? [];
    values.push(row);
    byAsset.set(row.asset_id, values);
  }
  return [...byAsset.values()].map((files) => {
    const primary = files.filter((file) => ['primary', 'source', 'audio', 'storyboard_image'].includes(file.role));
    if (primary.length !== 1) fail('REBUILD_PRIMARY_FILE_AMBIGUOUS', `Asset ${files[0].asset_id} has ${primary.length} retained candidates.`);
    return primary[0];
  });
}

function readStorageContext(db) {
  const scenes = new Map(db.prepare('SELECT id, production_number FROM scene').all().map((row) => [
    row.id,
    row.production_number,
  ]));
  const cast = new Map(db.prepare('SELECT id, handle FROM cast_member').all().map((row) => [row.id, row.handle]));
  const locations = new Map(db.prepare('SELECT id, handle FROM location').all().map((row) => [row.id, row.handle]));
  const props = new Map(db.prepare('SELECT id, handle FROM prop').all().map((row) => [row.id, row.handle]));
  const lookbooks = new Map(db.prepare('SELECT id, kind FROM lookbook').all().map((row) => [row.id, row.kind]));
  const plans = db.prepare('SELECT id, scene_id, created_at FROM shot_plan ORDER BY scene_id, created_at, id').all();
  const planContext = new Map();
  const scenePlanCounts = new Map();
  for (const plan of plans) {
    const number = (scenePlanCounts.get(plan.scene_id) ?? 0) + 1;
    scenePlanCounts.set(plan.scene_id, number);
    planContext.set(plan.id, { sceneId: plan.scene_id, number });
  }
  const shots = new Map(db.prepare('SELECT id, shot_plan_id, position FROM shot ORDER BY shot_plan_id, position, created_at, id').all().map((row, index, all) => {
    const inPlan = all.filter((candidate) => candidate.shot_plan_id === row.shot_plan_id);
    return [row.id, { planId: row.shot_plan_id, number: String(inPlan.findIndex((candidate) => candidate.id === row.id) + 1) }];
  }));
  const activeBeats = new Map();
  for (const row of db.prepare(`
    SELECT s.scene_id, s.document FROM scene_beat_sheet_state state
    JOIN scene_beat_sheet s ON s.id = state.active_beat_sheet_id
  `).all()) {
    const document = JSON.parse(row.document);
    for (let index = 0; index < document.beats.length; index += 1) {
      const beat = document.beats[index];
      activeBeats.set(`${row.scene_id}:${beat.id}`, { sceneId: row.scene_id, number: beat.number ?? String(index + 1) });
    }
  }
  const dialogue = dialogueContexts(db, scenes, cast);
  return { db, scenes, cast, locations, props, lookbooks, planContext, shots, activeBeats, dialogue };
}

function dialogueContexts(db, scenes, cast) {
  const result = new Map();
  for (const scene of db.prepare('SELECT id, blocks_json FROM scene').all()) {
    const turnIds = flattenDialogueTurns(JSON.parse(scene.blocks_json));
    for (const row of db.prepare('SELECT id, turn_id, cast_member_id FROM scene_dialogue_audio WHERE scene_id = ?').all(scene.id)) {
      const index = turnIds.indexOf(row.turn_id);
      if (index < 0) fail('REBUILD_DIALOGUE_TURN_MISSING', `Dialogue Turn was not found: ${row.turn_id}`);
      result.set(row.id, {
        scenePathSegment: sceneNumberPathSegment(scenes, scene.id),
        speaker: cast.get(row.cast_member_id),
        turnNumber: index + 1,
      });
    }
  }
  return result;
}

function flattenDialogueTurns(blocks) {
  return blocks.flatMap((block) => {
    if (block.type === 'dialogue') return [block.id];
    if (block.type === 'dualDialogue') return [block.left?.id, block.right?.id].filter(Boolean);
    return [];
  });
}

function allocateDestinationPath(row, context, allocated) {
  const owner = parseOwner(row.owner_key);
  let root;
  let generatedStem;
  if (row.type === 'screenplay_source') {
    root = 'screenplay';
    generatedStem = 'screenplay';
  } else if (row.type === 'lookbook_image' || row.type === 'lookbook_sheet') {
    root = `visual-language/lookbooks/${required(context.lookbooks.get(owner.id), row.owner_key)}`;
    generatedStem = semantic(row.title, row.type === 'lookbook_sheet' ? 'sheet' : '');
  } else if (row.type === 'cast_profile' || row.type === 'character_sheet' || row.type === 'cast_voice_sample') {
    root = `cast/${required(context.cast.get(owner.id), row.owner_key)}`;
    generatedStem = row.type === 'cast_profile' ? 'profile'
      : row.type === 'character_sheet' ? semantic(row.title, 'sheet')
        : semantic(row.reference_name ?? row.title);
  } else if (row.type === 'location_hero' || row.type === 'location_sheet') {
    root = `locations/${required(context.locations.get(owner.id), row.owner_key)}`;
    generatedStem = row.type === 'location_hero' ? 'hero' : semantic(row.title, 'sheet');
  } else if (row.type === 'prop_hero' || row.type === 'prop_sheet') {
    root = `props/${required(context.props.get(owner.id), row.owner_key)}`;
    generatedStem = row.type === 'prop_hero' ? 'hero' : semantic(row.title, 'sheet');
  } else if (row.type === 'scene_dialogue_audio') {
    const audio = context.db.prepare('SELECT scene_dialogue_audio_id FROM scene_dialogue_audio_take WHERE asset_id = ? AND discarded_at IS NULL').get(row.asset_id);
    const dialogue = required(context.dialogue.get(audio?.scene_dialogue_audio_id), row.asset_id);
    root = `scenes/${dialogue.scenePathSegment}/dialogues`;
    generatedStem = `s${dialogue.scenePathSegment}-${dialogue.speaker}-d${String(dialogue.turnNumber).padStart(2, '0')}`;
  } else if (row.type === 'scene_storyboard_image') {
    const beat = required(context.activeBeats.get(`${owner.sceneId}:${owner.beatId}`), row.owner_key);
    const iteration = /(?:^|\/)(\d{2}-iteration)(?:\/|$)/u.exec(row.project_relative_path)?.[1];
    if (!iteration) fail('REBUILD_STORYBOARD_ITERATION_MISSING', row.project_relative_path);
    const scenePathSegment = sceneNumberPathSegment(context.scenes, beat.sceneId);
    root = `storyboards/${scenePathSegment}/${iteration}`;
    generatedStem = `s${scenePathSegment}-b${displayNumber(beat.number)}-image`;
  } else if (row.type === 'shot_image') {
    const shot = required(context.shots.get(owner.id), row.owner_key);
    const plan = required(context.planContext.get(shot.planId), shot.planId);
    const scenePathSegment = sceneNumberPathSegment(context.scenes, plan.sceneId);
    root = `scenes/${scenePathSegment}/${String(plan.number).padStart(2, '0')}-shot-plan/shot-images`;
    generatedStem = `shot${displayNumber(shot.number)}`;
  } else if (row.type.startsWith('shot_plan_video')) {
    const planId = exactShotPlanId(row, context.db);
    const plan = required(context.planContext.get(planId), planId);
    const scenePathSegment = sceneNumberPathSegment(context.scenes, plan.sceneId);
    root = `scenes/${scenePathSegment}/${String(plan.number).padStart(2, '0')}-shot-plan`;
    generatedStem = row.type === 'shot_plan_video' ? `s${scenePathSegment}-p${String(plan.number).padStart(2, '0')}-video`
      : row.type === 'shot_plan_video_first_frame' ? 'first-frame'
        : row.type === 'shot_plan_video_last_frame' ? 'last-frame'
          : row.type === 'shot_plan_video_storyboard' ? 'storyboard' : 'reference';
  } else {
    fail('REBUILD_ASSET_TYPE_UNSUPPORTED', `Unsupported active Asset type: ${row.type}`);
  }
  const extension = normalizedExtension(row.project_relative_path);
  const fileName = row.origin === 'generated'
    ? allocateGeneratedName(generatedStem, extension, root, allocated)
    : allocateExternalName(path.parse(row.project_relative_path).name, extension, root, allocated);
  const destination = `${root}/${fileName}`;
  if (allocated.has(destination)) fail('REBUILD_DESTINATION_COLLISION', destination);
  allocated.add(destination);
  return destination;
}

function exactShotPlanId(row, db) {
  if (row.source_generation_spec_id) {
    const spec = db.prepare('SELECT authored_from_shot_plan_id FROM media_generation_spec WHERE id = ?').get(row.source_generation_spec_id);
    if (spec?.authored_from_shot_plan_id) return spec.authored_from_shot_plan_id;
  }
  const run = db.prepare(`
    SELECT r.spec_snapshot_json FROM asset_file_generation afg
    JOIN media_generation_run r ON r.id = afg.media_generation_run_id
    WHERE afg.asset_file_id = ?
  `).get(row.file_id);
  const authoredFrom = run ? JSON.parse(run.spec_snapshot_json).authoredFrom : null;
  if (authoredFrom?.kind === 'shotPlan' && authoredFrom.id) return authoredFrom.id;
  fail('REBUILD_SHOT_PLAN_PROVENANCE_MISSING', `Shot Plan media lacks exact provenance: ${row.file_id}`);
}

function retainedGenerationIds(db, fileIds) {
  const retainedRunIds = db.prepare(`SELECT DISTINCT media_generation_run_id AS id FROM asset_file_generation WHERE asset_file_id IN (${placeholders(fileIds)}) ORDER BY id`).all(...fileIds).map((row) => row.id);
  const specFromFiles = db.prepare(`SELECT DISTINCT source_generation_spec_id AS id FROM asset_file WHERE id IN (${placeholders(fileIds)}) AND source_generation_spec_id IS NOT NULL`).all(...fileIds).map((row) => row.id);
  const specFromRuns = retainedRunIds.length === 0 ? [] : db.prepare(`SELECT DISTINCT spec_id AS id FROM media_generation_run WHERE id IN (${placeholders(retainedRunIds)})`).all(...retainedRunIds).map((row) => row.id);
  const retainedSpecIds = [...new Set([...specFromFiles, ...specFromRuns])].sort();
  const allRunIds = db.prepare('SELECT id FROM media_generation_run ORDER BY id').all().map((row) => row.id);
  const allSpecIds = db.prepare('SELECT id FROM media_generation_spec ORDER BY id').all().map((row) => row.id);
  return {
    retainedRunIds,
    removedRunIds: allRunIds.filter((id) => !retainedRunIds.includes(id)),
    retainedSpecIds,
    removedSpecIds: allSpecIds.filter((id) => !retainedSpecIds.includes(id)),
  };
}

function discardedRowIds(db) {
  return {
    assetIds: db.prepare('SELECT id FROM asset WHERE discarded_at IS NOT NULL ORDER BY id').all().map((row) => row.id),
    assetFileIds: db.prepare('SELECT id FROM asset_file WHERE discarded_at IS NOT NULL ORDER BY id').all().map((row) => row.id),
    trashItemIds: db.prepare('SELECT id FROM trash_item ORDER BY id').all().map((row) => row.id),
    trashOperationIds: db.prepare('SELECT id FROM trash_operation ORDER BY id').all().map((row) => row.id),
  };
}

async function inventoryUserFolders(projectRoot) {
  const output = [];
  for (const root of ['visual-language/inspiration', 'research']) {
    const absoluteRoot = path.join(projectRoot, root);
    if (!fs.existsSync(absoluteRoot)) continue;
    await walkFiles(absoluteRoot, async (file) => {
      if (path.basename(file) === '.DS_Store') return;
      const relative = path.relative(projectRoot, file).split(path.sep).join('/');
      const stats = await fsp.stat(file);
      output.push({ path: relative, sizeBytes: stats.size, sha256: await hashFile(file) });
    });
  }
  return output.sort((a, b) => a.path.localeCompare(b.path));
}

async function inventoryTree(root) {
  const output = [];
  await walkFiles(root, async (file) => {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const stats = await fsp.stat(file);
    output.push({ path: relative, sizeBytes: stats.size, sha256: await hashFile(file) });
  });
  return output.sort((a, b) => a.path.localeCompare(b.path));
}

async function walkFiles(folder, visit) {
  for (const entry of await fsp.readdir(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) await walkFiles(target, visit);
    else if (entry.isFile()) await visit(target);
  }
}

function parseOwner(value) {
  if (value === 'project') return { kind: 'project' };
  const parts = value.split(':');
  if (parts[0] === 'sceneBeat' && parts.length === 3) return { kind: 'sceneBeat', sceneId: parts[1], beatId: parts[2] };
  if (parts.length === 2) return { kind: parts[0], id: parts[1] };
  fail('REBUILD_OWNER_INVALID', `Unsupported owner key: ${value}`);
}

function allocateGeneratedName(stem, extension, root, allocated) {
  const safe = fixedStem(stem);
  for (let attempt = 0; attempt < 16; attempt += 1) {
    let token = '';
    for (let index = 0; index < 3; index += 1) token += TOKEN_ALPHABET[crypto.randomInt(TOKEN_ALPHABET.length)];
    const name = `${safe}-g${token}${extension}`;
    if (!allocated.has(`${root}/${name}`)) return name;
  }
  fail('REBUILD_GENERATED_TOKEN_EXHAUSTED', `Could not allocate generated name for ${root}/${safe}`);
}

function allocateExternalName(sourceStem, extension, root, allocated) {
  const safe = semantic(sourceStem);
  for (let index = 0; index < 1000; index += 1) {
    const name = index === 0 ? `${safe}${extension}` : `${safe}-${index + 1}${extension}`;
    if (!allocated.has(`${root}/${name}`)) return name;
  }
  fail('REBUILD_EXTERNAL_NAME_EXHAUSTED', `Could not allocate external name for ${root}/${safe}`);
}

function semantic(value, suffix = '') {
  const normalizedSuffix = safeSegment(suffix);
  const max = 32 - (normalizedSuffix ? normalizedSuffix.length + 1 : 0);
  let base = safeSegment(value).slice(0, max).replace(/-+$/u, '');
  const suffixWords = new Set(['character-sheet', 'location-sheet', 'prop-sheet', 'lookbook-sheet', 'sheet']);
  for (const word of suffixWords) base = base.replace(new RegExp(`-${word}$`, 'u'), '');
  base = base.slice(0, max).replace(/-+$/u, '');
  if (!base) base = 'asset';
  return normalizedSuffix ? `${base}-${normalizedSuffix}` : base;
}

function safeSegment(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
}

function fixedStem(value) {
  const result = String(value).trim().replace(/[^A-Za-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 32).replace(/-+$/u, '');
  return required(result, value);
}

function normalizedExtension(file) {
  const extension = path.extname(file).toLowerCase() || '.png';
  return extension === '.jpeg' ? '.jpg' : extension;
}

function displayNumber(value) {
  return String(value).replace(/^([1-9])(?=[A-Za-z]*$)/u, '0$1');
}

function sceneNumberPathSegment(scenes, sceneId) {
  if (!scenes.has(sceneId)) {
    fail('REBUILD_RELATIONSHIP_MISSING', `Scene was not found: ${sceneId}`);
  }
  const productionNumber = safeSegment(scenes.get(sceneId)).slice(0, 32).replace(/-+$/u, '');
  if (productionNumber) return productionNumber;
  const safeSceneId = safeSegment(sceneId).slice(0, 26).replace(/-+$/u, '');
  if (!safeSceneId) return 'scene-unnumbered';
  return safeSceneId.startsWith('scene-') ? safeSceneId : `scene-${safeSceneId}`;
}

function placeholders(values) {
  if (values.length === 0) return "SELECT '' WHERE 0";
  return values.map(() => '?').join(',');
}

function scalar(db, sql) {
  return Object.values(db.prepare(sql).get())[0];
}

function normalizeStoredHash(value) {
  return value ? value.replace(/^sha256:/u, '') : null;
}

async function verifyCopiedFile(destination, evidence) {
  const stats = await fsp.stat(destination);
  const sha256 = await hashFile(destination);
  if (stats.size !== evidence.sizeBytes || sha256 !== evidence.sha256) {
    fail('REBUILD_COPIED_FILE_MISMATCH', `Copied file verification failed: ${destination}`);
  }
}

async function copyExclusive(source, destination) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
}

function summarizeTree(files) {
  const digest = crypto.createHash('sha256');
  let bytes = 0;
  for (const file of files) {
    bytes += file.sizeBytes;
    digest.update(`${file.path}\0${file.sizeBytes}\0${file.sha256}\n`);
  }
  return { files: files.length, bytes, sha256: digest.digest('hex') };
}

async function verifySourceTreeUnchanged(folder, expected, liveArchiveMoved) {
  const actual = summarizeTree(await inventoryTree(folder));
  if (actual.files !== expected.files || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
    fail('REBUILD_ARCHIVE_INTEGRITY_MISMATCH', JSON.stringify({ expected, actual }, null, 2));
  }
  return {
    liveArchiveMoved,
    sourceRootUnchanged: !liveArchiveMoved,
    path: folder,
    ...actual,
    matchesPreflightSource: true,
  };
}

function hashFileSync(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function hashFile(file) {
  return crypto.createHash('sha256').update(await fsp.readFile(file)).digest('hex');
}

async function writeJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'w' });
}

function assertAbsoluteSafePath(value, label) {
  if (!path.isAbsolute(value) || path.resolve(value) !== value || ['/', path.parse(value).root].includes(value)) {
    fail('REBUILD_PATH_INVALID', `${label} must be an explicit normalized absolute path: ${value}`);
  }
}

function assertInside(parent, child, label) {
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    fail('REBUILD_PATH_OUTSIDE_SCOPE', `${label} must be inside ${parent}: ${child}`);
  }
}

function required(value, label) {
  if (value === null || value === undefined || value === '') fail('REBUILD_RELATIONSHIP_MISSING', `Required relationship is missing: ${label}`);
  return value;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function parseArguments(values) {
  const parsed = { apply: false, rehearse: false, confirmation: undefined };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--apply') parsed.apply = true;
    else if (value === '--rehearse') parsed.rehearse = true;
    else if (value.startsWith('--')) {
      const name = value.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      parsed[name] = values[++index];
    } else fail('REBUILD_ARGUMENT_INVALID', `Unexpected argument: ${value}`);
  }
  for (const name of ['sourceRoot', 'archiveRoot', 'destinationRoot', 'databaseBackup', 'manifest']) {
    if (!parsed[name]) fail('REBUILD_ARGUMENT_REQUIRED', `Missing --${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}.`);
  }
  if (parsed.apply && parsed.rehearse) fail('REBUILD_MODE_CONFLICT', 'Use either --apply or --rehearse.');
  return parsed;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
