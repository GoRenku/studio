// Synthetic release-test authoring only. Historical shapes never enter Studio runtime.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { coreRoot } from './fixtures.mjs';
import { authorDocuments } from './authored-documents.mjs';

export async function populateProject(sourceProduct, projectFolder, generation) {
  const core = coreRoot(sourceProduct);
  const require = createRequire(path.join(core, 'package.json'));
  const Database = require('better-sqlite3');
  const { createProjectDataService, createDeterministicIdGenerator } = await import(pathToFileURL(path.join(core, 'dist/server/index.js')));
  const service = createProjectDataService();
  const input = { projectName: 'upgrade-fixture' };
  await service.applyCastOperations({ ...input, idGenerator: createDeterministicIdGenerator(), document: {
    kind: 'castOperations', operations: [{ operation: 'castMember.add', castMember: { key: 'narrator', handle: 'narrator', name: 'Narrator Ω', role: 'protagonist' } }],
  } });
  await service.applyLocationOperations({ ...input, idGenerator: createDeterministicIdGenerator(), document: {
    kind: 'locationOperations', operations: [{ operation: 'location.add', location: { key: 'room', handle: 'room', name: "Room ' 雪", description: 'Opaque authored description.' } }],
  } });
  await service.createScreenplay({ ...input, idGenerator: createDeterministicIdGenerator(), screenplay: {
    opening: [], scenes: ['scene', 'scene-two', 'scene-three'].map((key) => ({ key, heading: 'INT. ROOM - NIGHT', title: 'Saved Scene',
      blocks: [{ key: `action-${key}`, type: 'action', text: "Opaque Ω ' quoted text" }] })),
    sections: [], structure: ['scene', 'scene-two', 'scene-three'].map((key, position) => ({ key: `placement-${key}`,
      content: { type: 'scene', scene: { key } }, position })), references: [],
  } });
  const authoredSource = new Database(path.join(projectFolder, '.renku/project.sqlite'), { readonly: true });
  let authoredContext;
  try { authoredContext = { scenes: authoredSource.prepare('select id, blocks_json from scene order by production_number').all(),
    cast: authoredSource.prepare('select id from cast_member limit 1').get().id,
    location: authoredSource.prepare('select id from location limit 1').get().id }; }
  finally { authoredSource.close(); }
  await authorDocuments(service, input, createDeterministicIdGenerator, authoredContext.scenes, authoredContext.cast, authoredContext.location);
  const db = new Database(path.join(projectFolder, '.renku/project.sqlite'));
  db.pragma('foreign_keys = ON');
  assert.equal(db.pragma('user_version', { simple: true }), generation);
  const now = '2026-01-01T00:00:00.000Z';
  const opaque = JSON.stringify({ notes: "Ω ' 雪", prompt: 'asset:parent is opaque creative text', values: ['parent', 'file'] });
  const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFoQAAAAASUVORK5CYII=', 'base64');
  const audioBytes = Buffer.alloc(46);
  audioBytes.write('RIFF'); audioBytes.writeUInt32LE(38, 4); audioBytes.write('WAVEfmt ', 8);
  audioBytes.writeUInt32LE(16, 16); audioBytes.writeUInt16LE(1, 20); audioBytes.writeUInt16LE(1, 22);
  audioBytes.writeUInt32LE(8000, 24); audioBytes.writeUInt32LE(16000, 28);
  audioBytes.writeUInt16LE(2, 32); audioBytes.writeUInt16LE(16, 34); audioBytes.write('data', 36); audioBytes.writeUInt32LE(2, 40);
  const videoAssets = path.join(sourceProduct, 'app/node_modules/@gorenku/studio/dist/assets');
  const videoName = readdirSync(videoAssets).sort().find((name) => name.endsWith('.mp4'));
  assert.ok(videoName, 'The immutable source recipe requires a bundled example video');
  const videoBytes = readFileSync(path.join(videoAssets, videoName));
  const sourceBytes = Buffer.from('<FinalDraft DocumentType="Script" Version="1"><Content><Paragraph Type="Action"><Text>Synthetic source Ω</Text></Paragraph></Content></FinalDraft>');
  const insert = (table, row) => {
    const columns = db.prepare(`pragma table_info("${table}")`).all().map(({ name }) => name);
    const stamps = Object.fromEntries(['created_at', 'updated_at'].filter((name) => columns.includes(name)).map((name) => [name, now]));
    const record = { ...stamps, ...row };
    assert.ok(Object.keys(record).every((name) => columns.includes(name)), `Recipe column missing in ${table}`);
    db.prepare(`insert into "${table}" (${Object.keys(record).map((name) => `"${name}"`).join(',')}) values (${Object.keys(record).map(() => '?').join(',')})`).run(...Object.values(record));
  };
  const media = (id, type, owner, mediaKind = 'image', lifecycle = {}, parentId = `parent-${id}`) => {
    const relative = `media/${id}.${{ image: 'png', audio: 'wav', video: 'mp4', file: 'fdx' }[mediaKind]}`;
    const bytes = { image: imageBytes, audio: audioBytes, video: videoBytes, file: sourceBytes }[mediaKind];
    mkdirSync(path.dirname(path.join(projectFolder, relative)), { recursive: true });
    writeFileSync(path.join(projectFolder, relative), bytes);
    const physical = { id: `file-${id}`, project_relative_path: relative, media_kind: mediaKind,
      mime_type: { image: 'image/png', audio: 'audio/wav', video: 'video/mp4', file: 'application/xml' }[mediaKind], size_bytes: bytes.length,
      content_hash: createHash('sha256').update(bytes).digest('hex'), ...lifecycle };
    const authored = { type, title: `Saved ${id}`, origin: 'imported', availability: 'ready',
      ...(generation >= 65 && mediaKind !== 'file' ? { generation_provenance: JSON.stringify({ provider: 'fal-ai', model: 'synthetic-model', mediaKind,
        prompt: 'Opaque Ω', request: JSON.parse(opaque), receipt: { synthetic: true } }) } : {}), ...lifecycle };
    if (generation < 71) {
      insert('asset', { id: parentId, media_kind: mediaKind, ...authored });
      insert('asset_file', { ...physical, asset_id: parentId, role: 'primary' });
      insert('asset_membership', { asset_id: parentId, owner_key: owner });
    } else { insert('asset_file', { ...physical, owner_key: owner, ...authored }); }
    return generation < 71 ? parentId : physical.id;
  };
  try {
    db.transaction(() => {
      const scene = db.prepare('select id from scene limit 1').get().id;
      const cast = db.prepare('select id from cast_member limit 1').get().id;
      insert('shot_plan', { id: 'plan', scene_id: scene, number: 1, title: 'Saved Plan', coverage: opaque });
      insert('shot', { id: 'shot', shot_plan_id: 'plan', position: 0, number: '1', title: 'Saved Shot', description: opaque, brief: opaque });
      insert('inspiration_folder', { id: 'inspiration', name: 'Room references', project_relative_path: 'visual-language/inspiration/room', position: 0 });
      insert('lookbook', { id: 'production-lookbook', name: 'Saved Production Lookbook', kind: 'production', definition_json: JSON.stringify({
        thesis: { statement: 'Opaque Ω', principles: ['parent'] },
        palette: { description: '雪', colors: [{ hex: '#334455', name: 'Saved color', meaning: 'Opaque palette Ω' }], observations: [] },
        toneMood: { tone: 'Quiet', moodTags: ['Reflective'], description: 'Saved mood' },
        composition: { description: 'Saved composition', patterns: [{ name: 'Saved composition', description: 'Opaque Ω' }] },
        lighting: { description: 'Saved lighting', patterns: [{ name: 'Saved lighting', description: 'Opaque 雪' }] },
        texture: { description: 'Saved texture', observations: [] },
        camera: { description: 'Saved camera', movement: [{ name: 'Saved movement', description: 'Opaque Ω' }],
          motion: [{ name: 'Saved motion', description: 'Opaque 雪' }], framing: [{ name: 'Saved framing', description: 'Opaque quotation' }] },
      }) });
      insert('lookbook', { id: 'storyboard-lookbook', name: 'Saved Storyboard Lookbook', kind: 'storyboard', definition_json: JSON.stringify({
        styleBrief: { text: 'Opaque Ω' }, lineAndFinish: { text: 'parent' }, valueAndAccent: { text: '雪' }, guardrails: { text: 'Saved guardrails' },
      }) });
      insert('lookbook_inspiration', { id: 'inspired-lookbook', lookbook_id: 'production-lookbook', inspiration_folder_id: 'inspiration', sort_order: 0 });
      mkdirSync(path.join(projectFolder, 'visual-language/inspiration/room'), { recursive: true });
      writeFileSync(path.join(projectFolder, 'visual-language/inspiration/room/frame.png'), imageBytes);
      mkdirSync(path.join(projectFolder, 'research/nested'), { recursive: true });
      writeFileSync(path.join(projectFolder, 'research/nested/quoted.txt'), opaque);
      if (generation >= 71) {
        for (const [id, relative, owner, type, bytes, mime] of [
          ['file-inspiration', 'visual-language/inspiration/room/frame.png', 'inspirationFolder:inspiration', 'inspiration_image', imageBytes, 'image/png'],
          ['file-research', 'research/nested/quoted.txt', 'project', 'research_reference', Buffer.from(opaque), 'text/plain'],
        ]) {
          insert('asset_file', { id, owner_key: owner, type, media_kind: type === 'inspiration_image' ? 'image' : 'file',
            origin: 'imported', availability: 'ready', project_relative_path: relative, mime_type: mime,
            size_bytes: bytes.length, content_hash: createHash('sha256').update(bytes).digest('hex') });
        }
      }
      const cover = media('cover', 'project_cover', 'project');
      insert(generation < 71 ? 'selected_asset' : 'selected_asset_file', {
        target_key: 'project', [generation < 71 ? 'asset_id' : 'asset_file_id']: cover,
      });
      const voice = media('voice', 'cast_voice_sample', `castMember:${cast}`, 'audio');
      insert('cast_voice', { id: 'voice', cast_member_id: cast, name: 'Saved voice', purpose: 'dialogue',
        [generation < 71 ? 'sample_asset_id' : 'sample_asset_file_id']: voice,
        ...(generation >= 67 ? { voice_identity: opaque } : {}), sort_order: 0 });
      if (generation >= 67) { insert('cast_voice_default', { cast_member_id: cast, cast_voice_id: 'voice' }); }
      for (const kind of ['image', 'sheet']) {
        const asset = media(kind, `lookbook_${kind}`, 'lookbook:production-lookbook');
        insert(`lookbook_${kind}`, { id: kind, [generation < 71 ? 'asset_id' : 'asset_file_id']: asset, sort_order: 0 });
      }
      insert('lookbook_image_section', { id: 'section', image_id: 'image', section: 'palette', sort_order: 0 });
      const source = media('source', 'screenplay_source', 'project', 'file');
      insert('screenplay_import', { id: 'source-import', singleton_key: 1,
        ...(generation < 71 ? { source_asset_id: source } : {}), source_asset_file_id: 'file-source',
        importer_version: 1, imported_at: now, technical_log_json: '[]' });
      insert('trash_operation', { id: 'discard', command_name: 'discard', actor_kind: 'user' });
      const discarded = media('discarded', 'reference', 'project', 'image', { discarded_at: now, discard_operation_id: 'discard' });
      insert('trash_item', { id: 'trash', operation_id: 'discard', item_kind: generation < 71 ? 'asset' : 'assetFile',
        item_id: discarded, title: 'Discarded work', restore_snapshot_json: JSON.stringify({ [generation < 71 ? 'assetId' : 'assetFileId']: discarded, creative: JSON.parse(opaque) }) });
      const missingReference = 'visual-language/inspiration/room/collected.png';
      if (generation >= 71) {
        insert('asset_file', { id: 'file-collected-reference', owner_key: 'inspirationFolder:inspiration', type: 'inspiration_image',
          media_kind: 'image', origin: 'imported', availability: 'ready', project_relative_path: missingReference,
          mime_type: 'image/png', discarded_at: now, discard_operation_id: 'discard' });
      }
      insert('trash_item', { id: 'collected-reference', operation_id: 'discard',
        item_kind: generation < 71 ? 'inspirationImage' : 'assetFile',
        item_id: generation < 71 ? 'inspiration/collected.png' : 'file-collected-reference',
        owner_kind: 'inspirationFolder', owner_id: 'inspiration', title: generation < 71 ? 'collected.png' : '',
        original_project_relative_path: missingReference, garbage_collected_at: now,
        restore_snapshot_json: JSON.stringify(generation < 71 ? { folderId: 'inspiration', originalProjectRelativePath: missingReference } : { assetFileId: 'file-collected-reference' }) });
      const restoredImage = generation < 71 ? { assetId: 'parent-image' } : { assetFileId: 'file-image' };
      const restoredVoice = generation < 71 ? { sampleAssetId: 'parent-voice' } : { sampleAssetFileId: 'file-voice' };
      const restoredImages = generation < 71 ? { assetIds: ['parent-image', 'parent-sheet'] } : { assetFileIds: ['file-image', 'file-sheet'] };
      for (const [kind, item, envelope] of [
        ['lookbookImage', 'image', restoredImage], ['lookbookSheet', 'sheet', generation < 71 ? { assetId: 'parent-sheet' } : { assetFileId: 'file-sheet' }],
        ['castVoice', 'voice', restoredVoice], ['shot', 'shot', { images: restoredImages }],
        ['shotPlan', 'plan', { shots: [{ id: 'shot', images: restoredImages }] }],
      ]) {
        insert('trash_item', { id: `restored-${kind}`, operation_id: 'discard', item_kind: kind, item_id: item,
          title: 'Restored work', restored_at: now, restore_snapshot_json: JSON.stringify({ ...envelope, creative: JSON.parse(opaque) }) });
      }
      if (generation >= 67) {
        const dialogue = media('dialogue', 'shot_plan_dialogue_audio', 'project', 'audio');
        insert('shot_plan_dialogue_audio_take', { id: 'dialogue', shot_plan_id: 'plan',
          ...(generation < 71 ? { asset_id: dialogue } : {}), asset_file_id: 'file-dialogue', turn_start_number: 1, turn_end_number: 1, selected_at: now });
        insert('trash_item', { id: 'restored-dialogue', operation_id: 'discard', item_kind: 'shotPlanDialogueAudioTake', item_id: 'dialogue',
          title: 'Restored dialogue', restored_at: now, restore_snapshot_json: JSON.stringify({
            [generation < 71 ? 'assetId' : 'assetFileId']: dialogue, shotPlanId: 'plan', creative: JSON.parse(opaque) }) });
      } else {
        // 0083 deliberately supports these published development identities.
        // Only the IDs come from shipped SQL; all authored text and bytes here are synthetic.
        for (const [id, number] of [['shot_plan_bm34r9be', 2], ['shot_plan_sp24knrj', 3]]) {
          insert('shot_plan', { id, scene_id: scene, number, title: `Saved Plan ${number}`, coverage: opaque });
        }
        const asset = media('legacy-dialogue', 'scene_dialogue_audio', 'project', 'audio', {}, 'asset_86j7tf8v');
        insert('scene_dialogue_audio', { id: 'dialogue', scene_id: scene, turn_id: 'synthetic-turn', cast_member_id: cast,
          cast_voice_id: 'voice', model_choice: 'eleven_v3', plain_text: 'Synthetic dialogue Ω', v3_text: 'Synthetic dialogue Ω',
          voice_settings_json: opaque, output_format: 'pcm_8000' });
        insert('scene_dialogue_audio_take', { id: 'scene_dialogue_audio_take_x9j47jps', scene_dialogue_audio_id: 'dialogue',
          asset_id: asset, asset_file_id: 'file-legacy-dialogue', model_choice: 'eleven_v3', cast_voice_id: 'voice',
          cast_voice_name: 'Saved voice', provider: 'elevenlabs', provider_voice_id: 'synthetic-voice',
          provider_text_snapshot: 'Synthetic dialogue Ω', plain_text_snapshot: 'Synthetic dialogue Ω', v3_text_snapshot: 'Synthetic dialogue Ω',
          text_treatment: 'plain', voice_settings_snapshot_json: opaque, output_format: 'pcm_8000' });
      }
      if (generation >= 70) {
        const previs = media('previs', 'shot_plan_previs', 'project', 'video');
        insert('shot_plan_previs_revision', { id: 'revision', shot_plan_id: 'plan', number: 1, source_directory: 'previs/source', source_hash: 'source-hash', render_hash: 'render-hash', [generation < 71 ? 'asset_id' : 'asset_file_id']: previs });
        insert('shot_plan_clip', { id: 'clip', previs_revision_id: 'revision', number: 1 });
        for (const number of [1, 2]) {
          const asset = media(`take-${number}`, 'shot_plan_clip', 'project', 'video');
          insert('shot_plan_clip_take', { id: `take-${number}`, clip_id: 'clip', number,
            ...(generation < 71 ? { asset_id: asset } : {}), asset_file_id: `file-take-${number}`, source_take_id: number === 2 ? 'take-1' : null });
        }
        db.prepare('update shot_plan_clip set selected_take_id = ?').run('take-2');
      }
    })();
    assert.deepEqual(db.pragma('foreign_key_check'), []);
  } finally { db.close(); }
}
