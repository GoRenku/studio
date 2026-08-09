import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';

describe('migration 0071 Scene-first Screenplay', () => {
  it('preserves populated Screenplay, analysis, Beat, and dialogue-audio meaning', async () => {
    const sqlite = await populatedGeneration56Database();
    try {
      await applyMigration0071(sqlite);

      expect(sqlite.prepare('select project_name as projectName, title, synopsis, premise from project').get()).toEqual({
        projectName: 'migration-film',
        title: 'Migration Film',
        synopsis: 'The migrated synopsis.',
        premise: 'A maker confronts consequence.',
      });
      expect(sqlite.prepare('select count(*) as count from screenplay').get()).toEqual({ count: 1 });
      expect(sqlite.prepare('select id, production_number as productionNumber, heading from scene order by production_number').all()).toEqual([
        { id: 'scene_1', productionNumber: '1', heading: 'INT. The Forge - NIGHT' },
        { id: 'scene_2', productionNumber: '2', heading: 'EXT. The Forge - DAY' },
        { id: 'scene_3', productionNumber: '3', heading: 'INT. The Forge - DAWN' },
      ]);
      expect(sqlite.prepare('select section_type as type, count(*) as count from screenplay_section group by section_type order by section_type').all()).toEqual([
        { type: 'act', count: 3 },
        { type: 'sequence', count: 3 },
      ]);
      expect(sqlite.prepare("select count(*) as count from screenplay_reference where role = 'speaker' and turn_id = 'turn_1'").get()).toEqual({ count: 1 });
      expect(sqlite.prepare("select count(*) as count from screenplay_reference where role = 'mention'").get()).toEqual({ count: 6 });
      expect(sqlite.prepare("select turn_id as turnId from scene_dialogue_audio where id = 'audio_1'").get()).toEqual({ turnId: 'turn_1' });

      const beat = JSON.parse((sqlite.prepare("select document from scene_beat_sheet where id = 'beat_sheet_1'").get() as { document: string }).document) as {
        beats: Array<{ screenplayBlockIds: string[]; propIds: string[] }>;
        openQuestions?: string[];
      };
      expect(beat.beats[0]).toMatchObject({
        screenplayBlockIds: ['screenplay_block_scene_1_0000'],
        propIds: [],
      });
      expect(beat).not.toHaveProperty('openQuestions');

      const analysis = JSON.parse((sqlite.prepare("select document from screenplay_analysis where id = 'analysis_1'").get() as { document: string }).document) as Record<string, unknown>;
      expect(analysis).not.toHaveProperty('kind');
      expect(analysis).not.toHaveProperty('acts');
      expect(analysis).toMatchObject({
        structureModel: 'threeAct',
        actSegments: [
          expect.objectContaining({ role: 'actOne', sceneIds: ['scene_1'] }),
          expect.objectContaining({ role: 'actTwo', sceneIds: ['scene_2'] }),
          expect.objectContaining({ role: 'actThree', sceneIds: ['scene_3'] }),
        ],
        sceneGroups: [
          expect.objectContaining({ sceneIds: ['scene_1'] }),
          expect.objectContaining({ sceneIds: ['scene_2'] }),
          expect.objectContaining({ sceneIds: ['scene_3'] }),
        ],
        suggestedScenes: [
          expect.objectContaining({ placement: { afterSceneId: 'scene_1' } }),
        ],
      });
      expect(sqlite.prepare("select active_analysis_id as activeAnalysisId from screenplay_analysis_state").get()).toEqual({ activeAnalysisId: 'analysis_1' });
      expect(tableNames(sqlite)).not.toEqual(expect.arrayContaining(['act', 'sequence', 'scene_location', 'scene_production_number']));
      expect(sqlite.pragma('user_version', { simple: true })).toBe(57);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });

  it('rolls back the complete migration when duplicated Scene analysis identity disagrees', async () => {
    const sqlite = await populatedGeneration56Database();
    sqlite.prepare(`
      update screenplay_analysis
      set document = json_set(document, '$.scenes[0].title', 'Wrong title')
      where id = 'analysis_1'
    `).run();

    try {
      await expect(applyMigration0071(sqlite)).rejects.toThrow();
      expect(tableNames(sqlite)).toEqual(expect.arrayContaining(['act', 'sequence', 'scene_location', 'scene_production_number']));
      expect(tableNames(sqlite)).not.toContain('screenplay_section');
      expect(sqlite.prepare("select title from scene where id = 'scene_1'").get()).toEqual({ title: 'Opening' });
      expect(sqlite.pragma('user_version', { simple: true })).toBe(56);
    } finally {
      sqlite.close();
    }
  });
});

async function populatedGeneration56Database(): Promise<Database.Database> {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = on');
  const database = drizzle(sqlite);
  const migrationsFolder = await migrationsThroughGeneration56();
  migrate(database, { migrationsFolder });

  sqlite.exec(`
    insert into project (id, name, title, logline, aspect_ratio, summary, created_at, updated_at)
    values ('project_1', 'migration-film', 'Migration Film', 'The migrated logline.', '16:9', 'The migrated synopsis.', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    insert into screenplay (
      title, intended_audience, target_length_label, estimated_minutes,
      genre_primary, genre_secondary, tone, rating_intent, boundaries, logline,
      summary, premise_overview, central_conflict, dramatic_question, themes,
      historical_basis, dramatized_elements, status, research_sources,
      assumptions_made
    ) values (
      'Migration Film', 'Adults', 'short film', 12, 'Drama', '["History"]',
      '["Solemn"]', 'PG-13', '["No spectacle without consequence"]',
      'The migrated logline.', 'The migrated synopsis.',
      'A maker confronts consequence.', 'Craft serves power.',
      'Can the maker refuse?', '["responsibility"]', '["historical event"]',
      '["compressed timeline"]', 'first draft', '["archive"]',
      '["Keep the ending","Open question: Who bears witness?","Next iteration option: Sharpen the refusal"]'
    );
    insert into cast_member (id, name, role, position, handle, is_voice_over)
    values ('cast_urban', 'Urban', 'maker', 0, 'urban', 0);
    insert into location (id, name, position, handle)
    values ('location_forge', 'The Forge', 0, 'forge');
    insert into prop (id, handle, name, position)
    values ('prop_drawing', 'drawing', 'Drawing', 0);
    insert into act (id, title, purpose, position) values
      ('act_1', 'Act I', 'The offer', 0),
      ('act_2', 'Act II', 'The cost', 1),
      ('act_3', 'Act III', 'The consequence', 2);
    insert into sequence (id, act_id, title, purpose, position) values
      ('sequence_1', 'act_1', 'Opening group', 'Begin', 0),
      ('sequence_2', 'act_2', 'Middle group', 'Escalate', 0),
      ('sequence_3', 'act_3', 'Closing group', 'Resolve', 0);
  `);
  const sceneBlocks = [
    [
      { type: 'action', text: '@urban carries the drawing through @forge.', castMemberIds: ['cast_urban'], locationIds: ['location_forge'] },
      { type: 'dialogue', dialogueId: 'turn_1', castMemberId: 'cast_urban', extension: 'O.S.', parenthetical: 'quietly', lines: ['Hold @forge.'], castMemberIds: [], locationIds: ['location_forge'] },
    ],
    [{ type: 'action', text: 'The work continues.', castMemberIds: [], locationIds: [] }],
    [{ type: 'transition', text: 'FADE OUT:', castMemberIds: [], locationIds: [] }],
  ];
  const insertScene = sqlite.prepare(`
    insert into scene (id, sequence_id, title, interior_exterior, time_of_day, story_function, position, blocks_json)
    values (?, ?, ?, ?, ?, ?, 0, ?)
  `);
  insertScene.run('scene_1', 'sequence_1', 'Opening', 'INT', 'NIGHT', 'Introduction', JSON.stringify(sceneBlocks[0]));
  insertScene.run('scene_2', 'sequence_2', 'Middle', 'EXT', 'DAY', 'Escalation', JSON.stringify(sceneBlocks[1]));
  insertScene.run('scene_3', 'sequence_3', 'Ending', 'INT', 'DAWN', 'Resolution', JSON.stringify(sceneBlocks[2]));
  sqlite.exec(`
    insert into scene_location values ('scene_1', 'location_forge', 0), ('scene_2', 'location_forge', 0), ('scene_3', 'location_forge', 0);
    insert into scene_production_number values ('1', 'scene_1'), ('2', 'scene_2'), ('3', 'scene_3');
  `);
  sqlite.prepare(`
    insert into scene_beat_sheet (id, scene_id, title, document, created_at, updated_at)
    values ('beat_sheet_1', 'scene_1', 'Opening beats', ?, '2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z')
  `).run(JSON.stringify({
    kind: 'sceneBeats',
    sceneId: 'scene_1',
    title: 'Opening beats',
    summary: 'The maker arrives.',
    narrativeProgression: 'Arrival becomes warning.',
    openQuestions: [],
    beats: [{
      id: 'beat_1',
      title: 'Arrival',
      description: 'Urban enters the forge.',
      narrativeDevelopment: 'The maker meets the work.',
      narrativePurpose: 'Establish responsibility.',
      screenplayBlockIndexes: [0],
      castMemberIds: ['cast_urban'],
      locationIds: ['location_forge'],
    }],
  }));
  sqlite.exec(`
    insert into scene_beat_sheet_state values ('scene_1', 'beat_sheet_1', '2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z');
    insert into scene_dialogue_audio (
      id, scene_id, dialogue_id, cast_member_id, cast_voice_id, model_choice,
      plain_text, v3_text, voice_settings_json, output_format, language_code,
      created_at, updated_at
    ) values (
      'audio_1', 'scene_1', 'turn_1', 'cast_urban', null, 'model_1',
      'Hold The Forge.', 'Hold The Forge.', '{}', 'mp3', 'en',
      '2026-01-04T00:00:00.000Z', '2026-01-04T00:00:00.000Z'
    );
  `);
  const analysis = oldAnalysisDocument();
  sqlite.prepare(`
    insert into screenplay_analysis (id, structure_model, document, created_at, updated_at)
    values ('analysis_1', 'threeAct', ?, '2026-01-05T00:00:00.000Z', '2026-01-06T00:00:00.000Z')
  `).run(JSON.stringify(analysis));
  sqlite.exec(`
    insert into screenplay_analysis_state values (
      'screenplay-analysis-state', 'analysis_1',
      '2026-01-05T00:00:00.000Z', '2026-01-06T00:00:00.000Z'
    );
    pragma user_version = 56;
  `);
  return sqlite;
}

async function migrationsThroughGeneration56(): Promise<string> {
  const migrationsFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-migrations-through-0070-'));
  await fs.cp(path.join(process.cwd(), 'drizzle'), migrationsFolder, { recursive: true });
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8')) as {
    entries: Array<{ tag: string }>;
  };
  journal.entries = journal.entries.filter(
    (entry) => Number.parseInt(entry.tag.slice(0, 4), 10) <= 70,
  );
  await fs.writeFile(journalPath, JSON.stringify(journal));
  return migrationsFolder;
}

function oldAnalysisDocument() {
  const criteria = [
    { key: 'dramaticEnergy', label: 'Dramatic Energy', description: 'Momentum.' },
    { key: 'stakes', label: 'Stakes', description: 'Risk.' },
    { key: 'characterAgency', label: 'Character Agency', description: 'Choice.' },
  ];
  const scores = { dramaticEnergy: 70, stakes: 70, characterAgency: 70 };
  const critique = { summary: 'Clear.', evidence: [], suggestions: [] };
  const acts = ['actOne', 'actTwo', 'actThree'].map((actRole, index) => ({
    actId: `act_${index + 1}`,
    actRole,
    title: `Analytical act ${index + 1}`,
    synopsis: `Act ${index + 1} synopsis.`,
    scoreByCriterion: scores,
    critique,
  }));
  const sequences = [1, 2, 3].map((number) => ({
    sequenceId: `sequence_${number}`,
    actId: `act_${number}`,
    title: `Group ${number}`,
    synopsis: `Group ${number} synopsis.`,
    scoreByCriterion: scores,
    critique,
  }));
  const beatKeys = ['hook', 'incitingIncident', 'firstPlotPoint', 'firstPinchPoint', 'midpoint', 'secondPinchPoint', 'secondPlotPoint', 'climax', 'resolution'];
  const keyBeats = beatKeys.map((key, index) => {
    const number = Math.min(3, Math.floor(index / 3) + 1);
    return {
      key,
      label: key,
      actId: `act_${number}`,
      sequenceId: `sequence_${number}`,
      sceneId: `scene_${number}`,
      synopsis: `${key} synopsis.`,
      scoreByCriterion: scores,
      critique,
    };
  });
  const scenes = ['Opening', 'Middle', 'Ending'].map((title, index) => ({
    sceneId: `scene_${index + 1}`,
    sequenceId: `sequence_${index + 1}`,
    actId: `act_${index + 1}`,
    title,
    synopsis: `${title} synopsis.`,
    scoreByCriterion: scores,
    critique,
  }));
  return {
    kind: 'screenplayAnalysis',
    structureModel: 'threeAct',
    title: 'Migration analysis',
    summary: 'The complete analysis survives.',
    criteria,
    acts,
    keyBeats,
    sequences,
    scenes,
    suggestedSceneAdditions: [{
      targetActId: 'act_1',
      targetSequenceId: 'sequence_1',
      placement: { afterSceneId: 'scene_1' },
      title: 'A suggested Scene',
      purpose: 'Increase agency.',
      synopsis: 'Urban pauses before entering.',
      rationale: 'The choice becomes visible.',
    }],
  };
}

async function applyMigration0071(sqlite: Database.Database): Promise<void> {
  const migration = await fs.readFile(
    path.join(process.cwd(), 'drizzle', '0071_scene_first_screenplay.sql'),
    'utf8',
  );
  const statements = migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  sqlite.transaction(() => {
    statements.forEach((statement) => sqlite.exec(statement));
  })();
}

function tableNames(sqlite: Database.Database): string[] {
  return (sqlite.prepare("select name from sqlite_master where type = 'table' order by name").all() as Array<{ name: string }>).map((row) => row.name);
}
