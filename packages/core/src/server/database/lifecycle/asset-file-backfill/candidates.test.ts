import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSession } from '../store.js';
import { discoverAssetFileBackfillCandidates } from './candidates.js';
import { ProjectDataError } from '../../../project-data-error.js';

describe('retained reference backfill discovery', () => {
  let projectFolder: string;
  let sqlite: Database.Database;
  let session: DatabaseSession;

  beforeEach(() => {
    projectFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'renku-reference-backfill-'));
    sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE inspiration_folder (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, project_relative_path TEXT NOT NULL,
        position INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        discarded_at TEXT, discard_operation_id TEXT, restored_at TEXT
      );
      CREATE TABLE trash_item (
        id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, item_kind TEXT NOT NULL,
        item_id TEXT NOT NULL, restored_at TEXT, garbage_collected_at TEXT
      );
    `);
    session = { databasePath: ':memory:', db: drizzle(sqlite), close: () => sqlite.close() };
  });

  afterEach(() => {
    session.close();
    fs.rmSync(projectFolder, { recursive: true, force: true });
  });

  function write(relativePath: string, contents = 'retained bytes'): void {
    const absolute = path.join(projectFolder, relativePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, contents);
  }

  function folder(id: string, directory: string, operationId: string | null = null): void {
    sqlite.prepare('INSERT INTO inspiration_folder VALUES (?, ?, ?, 1, ?, ?, ?, ?, NULL)')
      .run(id, id, directory, 'now', 'now', operationId ? 'now' : null, operationId);
  }

  function collected(id: string, operationId: string, restored = false): void {
    sqlite.prepare('INSERT INTO trash_item VALUES (?, ?, ?, ?, ?, ?)')
      .run(`${id}-${operationId}`, operationId, 'inspirationFolder', id, restored ? 'later' : null, 'now');
  }

  function discover() {
    return discoverAssetFileBackfillCandidates({ session, projectFolder });
  }

  it('discovers flat folder images and recursive mixed research files without touching bytes or unrelated trees', () => {
    folder('coco', 'visual-language/inspiration/coco');
    folder('discarded', 'visual-language/inspiration/discarded', 'discard-current');
    write('visual-language/inspiration/coco/reference.PNG');
    write('visual-language/inspiration/coco/analysis.json');
    write('visual-language/inspiration/coco/nested/image.png');
    write('visual-language/inspiration/discarded/hidden.webp');
    write('research/notes.txt');
    write('research/nested/document.pdf');
    write('research/nested/voice.wav');
    write('research/opaque.bin');
    write('tmp/unretained.png');
    write('.renku/cache/thumbnail.png');
    write('screenplay/design.json');
    const before = sqlite.serialize();

    expect(discover()).toEqual([
      { projectRelativePath: 'visual-language/inspiration/coco/reference.PNG', ownerKey: 'inspirationFolder:coco', type: 'inspiration_image' },
      { projectRelativePath: 'visual-language/inspiration/discarded/hidden.webp', ownerKey: 'inspirationFolder:discarded', type: 'inspiration_image' },
      { projectRelativePath: 'research/nested/document.pdf', ownerKey: 'project', type: 'research_reference' },
      { projectRelativePath: 'research/nested/voice.wav', ownerKey: 'project', type: 'research_reference' },
      { projectRelativePath: 'research/notes.txt', ownerKey: 'project', type: 'research_reference' },
      { projectRelativePath: 'research/opaque.bin', ownerKey: 'project', type: 'research_reference' },
    ]);
    expect(sqlite.serialize()).toEqual(before);
    expect(fs.readFileSync(path.join(projectFolder, 'research/opaque.bin'), 'utf8')).toBe('retained bytes');
  });

  it('treats an absent research tree as empty', () => {
    expect(discover()).toEqual([]);
    expect(fs.existsSync(path.join(projectFolder, 'research'))).toBe(false);
  });

  it('skips a folder collected by its current discard without recreating it or scanning Trash bytes', () => {
    folder('collected', 'visual-language/inspiration/collected', 'current');
    collected('collected', 'current');
    write('.renku/trash/emptied/current/image.png');
    expect(discover()).toEqual([]);
    expect(fs.existsSync(path.join(projectFolder, 'visual-language/inspiration/collected'))).toBe(false);
  });

  it('reports every missing required folder; an older collected operation does not excuse the current discard', () => {
    folder('active', 'visual-language/inspiration/active');
    folder('pending', 'visual-language/inspiration/pending', 'current');
    collected('pending', 'older');
    try {
      discover();
      expect.fail('Missing directories must block discovery');
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectDataError);
      expect((error as ProjectDataError).code).toBe('PROJECT_ASSET_FILE_BACKFILL_FAILED');
      expect((error as ProjectDataError).issues).toHaveLength(2);
    }
  });

  it('does not use a restored collected entry to excuse a missing directory', () => {
    folder('restored', 'visual-language/inspiration/restored', 'current');
    collected('restored', 'current', true);
    expect(discover).toThrow(ProjectDataError);
  });

  it('rejects symlinked files and ancestor directories without traversing them', () => {
    write('tmp/secret.txt');
    fs.mkdirSync(path.join(projectFolder, 'research'));
    fs.symlinkSync(path.join(projectFolder, 'tmp/secret.txt'), path.join(projectFolder, 'research/link.txt'));
    fs.mkdirSync(path.join(projectFolder, 'visual-language/inspiration'), { recursive: true });
    fs.symlinkSync(path.join(projectFolder, 'tmp'), path.join(projectFolder, 'visual-language/inspiration/link'));
    folder('linked', 'visual-language/inspiration/link');
    expect(discover).toThrow(ProjectDataError);
  });

  it('rejects a registered Inspiration folder outside its retained root', () => {
    folder('invalid', 'tmp');
    write('tmp/image.png');
    expect(discover).toThrow(ProjectDataError);
  });

  it('rejects competing owners for one normalized reference path', () => {
    folder('one', 'visual-language/inspiration/shared');
    folder('two', 'visual-language/inspiration/shared/.');
    write('visual-language/inspiration/shared/image.png');
    expect(discover).toThrow(ProjectDataError);
  });
});
