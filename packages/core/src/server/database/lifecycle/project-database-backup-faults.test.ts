import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectDatabasePreMigrationBackup } from './project-database-backups.js';

const faults = vi.hoisted(() => ({
  operation: '', code: 'EIO', cleanup: false, corrupt: false, collision: false, vacuumStarted: false, handles: new Map<number, string>(),
}));
vi.mock('better-sqlite3', async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof Database }>();
  const fail = (operation: string) => {
    if (faults.operation === operation) {
      throw Object.assign(new Error(`Injected ${operation}`), { code: faults.code, syscall: operation });
    }
  };
  return { default: class extends actual.default {
    constructor(filename: string, options?: Database.Options) {
      if (filename.endsWith('project.sqlite')) { fail('source-open'); }
      super(filename, options);
      const prepare = this.prepare;
      this.prepare = ((sql: string) => {
        const statement = prepare.call(this, sql) as Database.Statement<unknown[]>;
        if (/^vacuum main into/i.test(sql)) {
          const run = statement.run;
          statement.run = (...args: unknown[]) => {
            faults.vacuumStarted = true;
            fail('vacuum'); fail('vacuum-close');
            return run.apply(statement, args);
          };
        }
        return statement;
      }) as typeof prepare;
      const close = this.close;
      this.close = () => {
        const result = close.call(this);
        if (filename.endsWith('project.sqlite')) { fail('source-close'); }
        if (filename.endsWith('project.sqlite') && faults.vacuumStarted) { fail('vacuum-close'); }
        return result;
      };
    }
  } };
});
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const fail = (operation: string) => {
    if (faults.operation === operation) {
      throw Object.assign(new Error(`Injected ${operation}`), { code: faults.code, syscall: operation });
    }
  };
  return {
    ...actual,
    existsSync: (...args: Parameters<typeof actual.existsSync>) => faults.collision && String(args[0]).endsWith('.partial.sqlite')
      ? true : actual.existsSync(...args),
    statSync: (...args: Parameters<typeof actual.statSync>) => {
      fail(String(args[0]).endsWith('project.sqlite') ? 'source-stat' : 'backup-stat');
      return actual.statSync(...args);
    },
    mkdirSync: (...args: Parameters<typeof actual.mkdirSync>) => { fail('mkdir'); return actual.mkdirSync(...args); },
    openSync: (...args: Parameters<typeof actual.openSync>) => {
      const file = String(args[0]);
      fail(file.endsWith('.json') ? 'metadata-open' : 'backup-open');
      const fd = actual.openSync(...args);
      faults.handles.set(fd, file);
      // Simulate the Windows write-access requirement on every native host.
      if (file.endsWith('.sqlite')) { expect(args[1]).toBe('r+'); }
      return fd;
    },
    fsyncSync: (fd: number) => {
      const file = faults.handles.get(fd)!;
      fail(file.endsWith('.json') ? 'metadata-flush' : file.endsWith('.sqlite') ? 'backup-flush' : 'directory-flush');
      const result = actual.fsyncSync(fd);
      if (faults.corrupt && file.endsWith('.partial.sqlite')) { actual.writeFileSync(file, 'corrupted fixture'); }
      return result;
    },
    closeSync: (fd: number) => {
      const file = faults.handles.get(fd)!;
      actual.closeSync(fd);
      faults.handles.delete(fd);
      if (file.endsWith('.json')) { fail('metadata-close'); }
      fail('close');
    },
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => { fail('metadata-write'); return actual.writeFileSync(...args); },
    renameSync: (...args: Parameters<typeof actual.renameSync>) => {
      fail(String(args[1]).endsWith('.json') ? 'metadata-rename' : 'backup-rename');
      return actual.renameSync(...args);
    },
    unlinkSync: (...args: Parameters<typeof actual.unlinkSync>) => {
      if (faults.cleanup) { throw Object.assign(new Error('Injected cleanup'), { code: 'EPERM' }); }
      return actual.unlinkSync(...args);
    },
  };
});

describe('backup filesystem failures', () => {
  let databasePath: string;
  let sourceBytes: Buffer;
  beforeEach(() => {
    faults.operation = '';
    faults.cleanup = false;
    faults.corrupt = false;
    faults.collision = false;
    faults.vacuumStarted = false;
    faults.code = 'EIO';
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "renku-backup-faults-é ' "));
    databasePath = path.join(root, 'project.sqlite');
    const sqlite = new Database(databasePath);
    sqlite.exec("create table saved_work (id text primary key, text text); insert into saved_work values ('a', 'opaque Ω');");
    sqlite.close();
    sourceBytes = fs.readFileSync(databasePath);
  });
  afterEach(() => {
    expect(faults.handles.size).toBe(0);
    expect(fs.readFileSync(databasePath)).toEqual(sourceBytes);
  });

  for (const [operation, code] of [
    ['source-stat', '046'], ['source-open', '046'], ['source-close', '046'], ['vacuum', '046'],
    ['mkdir', '046'], ['backup-open', '046'],
    ['backup-flush', '046'], ['close', '046'], ['backup-stat', '047'],
    ['backup-rename', '047'], ['metadata-open', '048'], ['metadata-write', '048'],
    ['metadata-flush', '048'], ['metadata-close', '048'], ['metadata-rename', '048'],
    ...(process.platform === 'win32' ? [] : [['directory-flush', '047']]),
  ]) {
    it(`reports ${operation} without modifying the source`, () => {
      faults.operation = operation;
      expect(() => createProjectDatabasePreMigrationBackup(databasePath)).toThrow(expect.objectContaining({
        code: `PROJECT_DATA${code}`, issues: expect.arrayContaining([expect.objectContaining({
          message: expect.stringContaining('EIO'), location: expect.objectContaining({ filePath: expect.any(String) }),
        })]),
      }));
      if (operation.startsWith('metadata-') || operation === 'backup-stat' || operation === 'directory-flush') {
        const backups = fs.readdirSync(path.join(path.dirname(databasePath), 'project-database-backups'));
        const retained = backups.find((name) => name.endsWith('.sqlite') && !name.includes('.partial.'));
        expect(retained).toBeDefined();
        const backup = new Database(path.join(path.dirname(databasePath), 'project-database-backups', retained!), { readonly: true });
        expect(backup.prepare('select * from saved_work').all()).toEqual([{ id: 'a', text: 'opaque Ω' }]);
        backup.close();
      }
    });
  }

  for (const code of ['EACCES', 'EPERM', 'ENOSPC', 'EIO']) {
    it(`retains the primary ${code} flush error when partial cleanup also fails`, () => {
      faults.operation = 'backup-flush';
      faults.code = code;
      faults.cleanup = true;
      expect(() => createProjectDatabasePreMigrationBackup(databasePath)).toThrow(expect.objectContaining({
        code: 'PROJECT_DATA046', message: expect.stringContaining(code),
        issues: [expect.objectContaining({ location: expect.objectContaining({ context: 'flush backup' }) }),
          expect.objectContaining({ location: expect.objectContaining({ context: 'remove partial file' }) })],
      }));
    });
  }

  it('flushes a writable non-truncating handle and retains opaque contents', () => {
    const report = createProjectDatabasePreMigrationBackup(databasePath)!;
    const backup = new Database(report.backupPath, { readonly: true });
    expect(backup.prepare('select * from saved_work').all()).toEqual([{ id: 'a', text: 'opaque Ω' }]);
    backup.close();
  });

  it('keeps the VACUUM failure primary when closing its SQLite connection also fails', () => {
    faults.operation = 'vacuum-close';
    expect(() => createProjectDatabasePreMigrationBackup(databasePath)).toThrow(expect.objectContaining({
      code: 'PROJECT_DATA046', issues: [
        expect.objectContaining({ location: expect.objectContaining({ context: 'SQLite VACUUM INTO' }) }),
        expect.objectContaining({ location: expect.objectContaining({ context: 'close database' }) }),
      ],
    }));
  });

  it('rejects a corrupt partial database instead of publishing it as a backup', () => {
    faults.corrupt = true;
    expect(() => createProjectDatabasePreMigrationBackup(databasePath))
      .toThrow(expect.objectContaining({ code: 'PROJECT_DATA047' }));
    expect(fs.readdirSync(path.join(path.dirname(databasePath), 'project-database-backups'))).toEqual([]);
  });

  it('fails bounded name collisions without overwriting existing backups', () => {
    const first = createProjectDatabasePreMigrationBackup(databasePath)!;
    const bytes = fs.readFileSync(first.backupPath);
    faults.collision = true;
    expect(() => createProjectDatabasePreMigrationBackup(databasePath))
      .toThrow(expect.objectContaining({ code: 'PROJECT_DATA046' }));
    expect(fs.readFileSync(first.backupPath)).toEqual(bytes);
  });

  if (process.platform !== 'win32') {
    it.each(['EINVAL', 'ENOTSUP'])('permits explicitly unsupported directory sync (%s) after mandatory file flushes', (code) => {
      faults.operation = 'directory-flush';
      faults.code = code;
      const report = createProjectDatabasePreMigrationBackup(databasePath)!;
      expect(fs.existsSync(report.backupPath)).toBe(true);
      expect(fs.existsSync(report.metadataPath)).toBe(true);
    });
  }
});
