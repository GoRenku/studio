import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0076 stable production numbers and Scene Beats', () => {
  it('preserves every revision while backfilling generic Plan and Shot numbers', async () => {
    const sqlite = new Database(':memory:');
    try {
      createGeneration60Fixture(sqlite);
      executeTransactionally(sqlite, await migrationSql());

      expect(sqlite.pragma('user_version', { simple: true })).toBe(61);
      expect(sqlite.prepare('select production_number from scene order by id').all()).toEqual([
        { production_number: null },
        { production_number: '2A' },
      ]);
      sqlite.prepare(
        'insert into scene values (?, ?, ?, null, ?)'
      ).run('scene_3', '2A', 'INT. ROOM 3 - DAY', '[]');
      sqlite.prepare(
        'insert into scene values (?, ?, ?, null, ?)'
      ).run('scene_4', '', 'INT. ROOM 4 - DAY', '[]');
      sqlite.prepare(
        'insert into scene values (?, ?, ?, null, ?)'
      ).run('scene_5', 'not/a/generated/number', 'INT. ROOM 5 - DAY', '[]');
      expect(sqlite.prepare(
        'select production_number from scene where id in (?, ?, ?) order by id'
      ).all('scene_3', 'scene_4', 'scene_5')).toEqual([
        { production_number: '2A' },
        { production_number: '' },
        { production_number: 'not/a/generated/number' },
      ]);
      expect(sqlite.prepare(
        'select count(*) count from agent_scene_number_reservation'
      ).get()).toEqual({ count: 0 });
      expect(sqlite.prepare(
        'select id, scene_id from screenplay_structure_entry order by id'
      ).all()).toEqual([
        { id: 'structure_scene_1', scene_id: 'scene_1' },
        { id: 'structure_scene_2', scene_id: 'scene_2' },
      ]);
      expect(sqlite.prepare(
        'select id, scene_id from screenplay_reference order by id'
      ).all()).toEqual([
        { id: 'reference_scene_1', scene_id: 'scene_1' },
        { id: 'reference_scene_2', scene_id: 'scene_2' },
      ]);

      const revisions = sqlite.prepare(
        'select id, scene_id, document, created_at, updated_at from scene_beats_revision order by id'
      ).all() as Array<{
        id: string;
        scene_id: string;
        document: string;
        created_at: string;
        updated_at: string;
      }>;
      expect(revisions).toHaveLength(6);
      for (const revision of revisions) {
        const revisionIndex = Number(revision.id.at(-1));
        const document = JSON.parse(revision.document) as {
          sceneBeats: {
            sceneId: string;
            beats: Array<Record<string, unknown>>;
          };
          baseRevisionId?: string;
          reservedNumbers: string[];
        };
        expect(document.sceneBeats.sceneId).toBe(revision.scene_id);
        expect(document.sceneBeats.beats).toEqual([expect.objectContaining({
          id: `beat_${revision.scene_id}_${revisionIndex}`,
          number: '1',
          title: `Beat ${revision.scene_id} revision ${revisionIndex}`,
          description: 'Exact creative description.',
          narrativeDevelopment: 'Exact narrative development.',
          narrativePurpose: 'Exact narrative purpose.',
          cameraIntent: 'Preserved extension field.',
        })]);
        expect(document.reservedNumbers).toEqual(['1']);
        expect(document).not.toHaveProperty('title');
        expect(document).not.toHaveProperty('summary');
        expect(document).not.toHaveProperty('narrativeProgression');
        expect(document).not.toHaveProperty('lookbookInfluence');
        expect(document).not.toHaveProperty('openQuestions');
        expect(document.baseRevisionId).toBe(
          revisionIndex === 1
            ? undefined
            : `revision_${revision.scene_id}_${revisionIndex - 1}`
        );
        expect(revision.created_at).toBe(`2026-01-0${revisionIndex}T00:00:00.000Z`);
        expect(revision.updated_at).toBe(revision.created_at);
      }

      expect(sqlite.prepare(
        'select scene_id, active_revision_id from scene_beats_state order by scene_id'
      ).all()).toEqual([
        { scene_id: 'scene_1', active_revision_id: 'revision_scene_1_3' },
        { scene_id: 'scene_2', active_revision_id: 'revision_scene_2_3' },
      ]);
      expect(sqlite.prepare(
        'select id, scene_id, number from shot_plan order by scene_id, number'
      ).all()).toEqual([
        { id: 'shot_plan_a', scene_id: 'scene_1', number: 1 },
        { id: 'shot_plan_b', scene_id: 'scene_1', number: 2 },
        { id: 'shot_plan_c', scene_id: 'scene_2', number: 1 },
      ]);
      expect(sqlite.prepare(
        'select id, shot_plan_id, position, number from shot order by shot_plan_id, position'
      ).all()).toEqual([
        { id: 'shot_a_0', shot_plan_id: 'shot_plan_a', position: 0, number: '1' },
        { id: 'shot_a_2', shot_plan_id: 'shot_plan_a', position: 2, number: '2' },
        { id: 'shot_b_0', shot_plan_id: 'shot_plan_b', position: 0, number: '1' },
      ]);
      expect(sqlite.prepare(
        'select scene_id, last_number from scene_shot_plan_number order by scene_id'
      ).all()).toEqual([
        { scene_id: 'scene_1', last_number: 2 },
        { scene_id: 'scene_2', last_number: 1 },
      ]);
      expect(sqlite.prepare(
        'select shot_plan_id, number, number_key, shot_id from shot_number_reservation order by shot_plan_id, number'
      ).all()).toEqual([
        { shot_plan_id: 'shot_plan_a', number: '1', number_key: '1', shot_id: 'shot_a_0' },
        { shot_plan_id: 'shot_plan_a', number: '2', number_key: '2', shot_id: 'shot_a_2' },
        { shot_plan_id: 'shot_plan_b', number: '1', number_key: '1', shot_id: 'shot_b_0' },
      ]);
      expect(sqlite.prepare(
        `select json_extract(coverage, '$.sceneBeatsRevisionId') revision_id,
                json_type(coverage, '$.beatSheetId') retired_field
         from shot_plan where id = 'shot_plan_a'`
      ).get()).toEqual({
        revision_id: 'revision_scene_1_3',
        retired_field: null,
      });

      const settings = JSON.parse(
        (sqlite.prepare('select document from project_settings').get() as { document: string }).document
      ) as Record<string, unknown>;
      expect(settings).toMatchObject({
        version: 2,
        screenplayImport: {
          createContinuitySubjects: true,
          generateSceneBeats: true,
          generateBeatStoryboardImages: false,
        },
        generation: {
          displayPreview: true,
        },
      });
      expect(JSON.stringify(settings)).not.toContain('generateSceneBeatSheets');
      expect(JSON.stringify(settings)).not.toContain('allowRenkuSceneNumberGeneration');
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('preserves the exact active pointer instead of selecting or deleting revisions', async () => {
    const sqlite = new Database(':memory:');
    try {
      createGeneration60Fixture(sqlite);
      sqlite.prepare(
        "update scene_beat_sheet_state set active_beat_sheet_id = 'revision_scene_1_1' where scene_id = 'scene_1'"
      ).run();

      executeTransactionally(sqlite, await migrationSql());

      expect(sqlite.prepare(
        "select active_revision_id from scene_beats_state where scene_id = 'scene_1'"
      ).get()).toEqual({ active_revision_id: 'revision_scene_1_1' });
      expect(sqlite.prepare(
        "select count(*) count from scene_beats_revision where scene_id = 'scene_1'"
      ).get()).toEqual({ count: 3 });
    } finally {
      sqlite.close();
    }
  });
});

async function migrationSql(): Promise<string> {
  return (await fs.readFile(
    path.join(process.cwd(), 'drizzle', '0076_stable_production_numbers_and_scene_beats.sql'),
    'utf8'
  )).replaceAll('--> statement-breakpoint', '');
}

function executeTransactionally(sqlite: Database.Database, sql: string): void {
  sqlite.exec(`begin;\n${sql}\ncommit;`);
}

function createGeneration60Fixture(sqlite: Database.Database): void {
  sqlite.exec(`
    create table project_settings (
      singleton_id integer primary key,
      document text not null
    );
    insert into project_settings values (
      1,
      '{"version":1,"screenplayImport":{"createContinuitySubjects":true,"generateContinuityImages":false,"runScreenplayAnalysis":false,"generateSceneBeatSheets":true,"generateBeatStoryboardImages":false},"generation":{"preferCodexImageGeneration":true,"displayPreview":true,"renkuManaged":{"requirePerRunConfirmation":true,"allowConcurrentGenerations":false,"maxConcurrentGenerations":1},"codexBuiltIn":{"requirePerRunConfirmation":false,"allowConcurrentGenerations":true,"maxConcurrentGenerations":5}}}'
    );
    create table scene (
      id text primary key,
      production_number text,
      heading text not null,
      title text,
      blocks_json text not null default '[]',
      constraint scene_heading_non_empty_check check(length(heading) > 0),
      constraint scene_production_number_non_empty_check
        check(production_number is null or length(production_number) > 0)
    );
    create unique index scene_production_number_unique_idx
      on scene (production_number) where production_number is not null;
    insert into scene values ('scene_1', null, 'INT. ROOM 1 - DAY', null, '[]');
    insert into scene values ('scene_2', '2A', 'INT. ROOM 2 - DAY', null, '[]');
    create table screenplay_structure_entry (
      id text primary key,
      scene_id text references scene(id) on delete cascade
    );
    insert into screenplay_structure_entry values ('structure_scene_1', 'scene_1');
    insert into screenplay_structure_entry values ('structure_scene_2', 'scene_2');
    create table screenplay_reference (
      id text primary key,
      scene_id text references scene(id) on delete cascade
    );
    insert into screenplay_reference values ('reference_scene_1', 'scene_1');
    insert into screenplay_reference values ('reference_scene_2', 'scene_2');

    create table scene_beat_sheet (
      id text primary key,
      scene_id text not null,
      title text not null,
      document text not null,
      created_at text not null,
      updated_at text not null
    );
    create index scene_beat_sheet_scene_updated_idx
      on scene_beat_sheet (scene_id, updated_at, id);
    create table scene_beat_sheet_state (
      scene_id text primary key,
      active_beat_sheet_id text references scene_beat_sheet(id) on delete set null,
      created_at text not null,
      updated_at text not null
    );

    create table shot_plan (
      id text primary key,
      scene_id text not null,
      title text not null,
      coverage text,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create index shot_plan_scene_active_created_idx
      on shot_plan (scene_id, discarded_at, created_at, id);
    create table shot (
      id text primary key,
      shot_plan_id text not null references shot_plan(id) on delete cascade,
      position integer not null,
      title text not null,
      description text not null,
      brief text not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create unique index shot_plan_position_unique_idx on shot (shot_plan_id, position);
    create index shot_plan_id_idx on shot (shot_plan_id, id);
  `);

  for (const sceneId of ['scene_1', 'scene_2']) {
    for (let revisionIndex = 1; revisionIndex <= 3; revisionIndex += 1) {
      const revisionId = `revision_${sceneId}_${revisionIndex}`;
      const document = JSON.stringify({
        sceneId,
        title: `Revision ${revisionIndex}`,
        summary: 'Historical summary.',
        narrativeProgression: 'Historical progression.',
        lookbookInfluence: 'Historical influence.',
        openQuestions: ['Historical question.'],
        ...(revisionIndex > 1
          ? { baseBeatSheetId: `revision_${sceneId}_${revisionIndex - 1}` }
          : {}),
        beats: [{
          id: `beat_${sceneId}_${revisionIndex}`,
          title: `Beat ${sceneId} revision ${revisionIndex}`,
          description: 'Exact creative description.',
          narrativeDevelopment: 'Exact narrative development.',
          narrativePurpose: 'Exact narrative purpose.',
          castMemberIds: [],
          locationIds: [],
          propIds: [],
          screenplayBlockIds: [],
          cameraIntent: 'Preserved extension field.',
        }],
      });
      const timestamp = `2026-01-0${revisionIndex}T00:00:00.000Z`;
      sqlite.prepare(
        'insert into scene_beat_sheet values (?, ?, ?, ?, ?, ?)'
      ).run(revisionId, sceneId, `Revision ${revisionIndex}`, document, timestamp, timestamp);
    }
    sqlite.prepare(
      'insert into scene_beat_sheet_state values (?, ?, ?, ?)'
    ).run(
      sceneId,
      `revision_${sceneId}_3`,
      '2026-01-01T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z'
    );
  }

  const plans = [
    {
      id: 'shot_plan_b',
      sceneId: 'scene_1',
      coverage: null,
      createdAt: '2026-02-02T00:00:00.000Z',
    },
    {
      id: 'shot_plan_a',
      sceneId: 'scene_1',
      coverage: JSON.stringify({
        beatSheetId: 'revision_scene_1_3',
        beatIds: ['beat_scene_1_3'],
      }),
      createdAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'shot_plan_c',
      sceneId: 'scene_2',
      coverage: null,
      createdAt: '2026-02-01T00:00:00.000Z',
    },
  ];
  for (const plan of plans) {
    sqlite.prepare(
      'insert into shot_plan values (?, ?, ?, ?, ?, ?, null, null, null)'
    ).run(
      plan.id,
      plan.sceneId,
      `Plan ${plan.id}`,
      plan.coverage,
      plan.createdAt,
      plan.createdAt
    );
  }
  for (const shot of [
    { id: 'shot_a_2', planId: 'shot_plan_a', position: 2 },
    { id: 'shot_a_0', planId: 'shot_plan_a', position: 0 },
    { id: 'shot_b_0', planId: 'shot_plan_b', position: 0 },
  ]) {
    sqlite.prepare(
      'insert into shot values (?, ?, ?, ?, ?, ?, ?, ?, null, null, null)'
    ).run(
      shot.id,
      shot.planId,
      shot.position,
      `Shot ${shot.id}`,
      'Exact description.',
      '{}',
      '2026-02-03T00:00:00.000Z',
      '2026-02-03T00:00:00.000Z'
    );
  }
  sqlite.pragma('foreign_keys = on');
}
