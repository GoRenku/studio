import Database from 'better-sqlite3';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { createProjectDatabasePreMigrationBackup } from './project-database-backups.js';

function populatedSource() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "renku-native-backup-Ω ' "));
  const databasePath = path.join(folder, 'project.sqlite');
  const db = new Database(databasePath);
  db.exec('create table saved_work (id text primary key, document text)');
  db.prepare('insert into saved_work values (?, ?)').run('saved', "Opaque Ω ' 雪");
  db.close();
  return { folder, databasePath };
}

it('retains native Unicode and quoted paths and releases backup handles', () => {
  const { databasePath } = populatedSource();
  const report = createProjectDatabasePreMigrationBackup(databasePath)!;
  const moved = `${report.backupPath}.retained`;
  fs.renameSync(report.backupPath, moved);
  const db = new Database(moved, { readonly: true });
  try { expect(db.prepare('select * from saved_work').all()).toEqual([{ id: 'saved', document: "Opaque Ω ' 雪" }]); }
  finally { db.close(); }
});

it('preserves saved work near native path-length limits or reports the storage failure', () => {
  const { folder, databasePath } = populatedSource();
  let nested = folder;
  while (nested.length < 200) { nested = path.join(nested, 'nested-path-'.repeat(4)); }
  fs.mkdirSync(nested, { recursive: true });
  const source = path.join(nested, 'project.sqlite');
  fs.copyFileSync(databasePath, source);
  const original = fs.readFileSync(source);
  try {
    const report = createProjectDatabasePreMigrationBackup(source)!;
    const backup = new Database(report.backupPath, { readonly: true });
    try { expect(backup.prepare('select * from saved_work').all()).toEqual([{ id: 'saved', document: "Opaque Ω ' 雪" }]); }
    finally { backup.close(); }
  } catch (error) {
    // Windows SQLite may reject the longer VACUUM destination even when Node
    // can read the source. That native limit must be actionable and write-safe.
    if (process.platform !== 'win32') { throw error; }
    expect(error).toMatchObject({ code: 'PROJECT_DATA046', issues: expect.any(Array) });
  }
  expect(fs.readFileSync(source)).toEqual(original);
});

if (process.platform !== 'win32') {
  it('fails with a located diagnostic when a native path component exceeds filesystem limits', () => {
    const { folder, databasePath } = populatedSource();
    const original = fs.readFileSync(databasePath);
    const invalidPath = path.join(folder, 'x'.repeat(300), 'project.sqlite');
    expect(() => createProjectDatabasePreMigrationBackup(invalidPath)).toThrow(expect.objectContaining({
      code: 'PROJECT_DATA046', issues: expect.arrayContaining([expect.objectContaining({
        location: expect.objectContaining({ filePath: invalidPath }),
      })]),
    }));
    expect(fs.readFileSync(databasePath)).toEqual(original);
  });
}

if (process.platform === 'win32') {
  it('fails safely while Windows holds an exclusive source handle and succeeds after release', async () => {
    const { databasePath } = populatedSource();
    const original = fs.readFileSync(databasePath);
    const literal = `'${databasePath.replaceAll("'", "''")}'`;
    const holder = spawn('powershell.exe', ['-NoProfile', '-Command',
      `$handle = [IO.File]::Open(${literal}, 'Open', 'ReadWrite', 'None'); try { [Console]::WriteLine('held'); [Console]::ReadLine() | Out-Null } finally { $handle.Dispose() }`],
    { stdio: ['pipe', 'pipe', 'pipe'] });
    const exit = new Promise((resolve) => holder.once('close', resolve));
    let output = '';
    const held = new Promise<void>((resolve, reject) => {
      holder.once('error', reject);
      holder.stdout.on('data', (chunk) => { output += chunk; if (output.includes('held')) { resolve(); } });
      holder.once('exit', () => reject(new Error(`Exclusive handle process exited early: ${output}`)));
    });
    const timer = setTimeout(() => holder.kill('SIGKILL'), 10000);
    try {
      await held;
      expect(() => createProjectDatabasePreMigrationBackup(databasePath)).toThrow(expect.objectContaining({
        code: 'PROJECT_DATA046', issues: expect.any(Array),
      }));
      holder.stdin.end('\n');
      expect(await exit).toBe(0);
      expect(fs.readFileSync(databasePath)).toEqual(original);
      expect(createProjectDatabasePreMigrationBackup(databasePath)?.backupPath).toBeTruthy();
    } finally {
      clearTimeout(timer);
      holder.kill('SIGKILL');
    }
  });
} else {
  it('blocks writes to a read-only backup destination and preserves the source', () => {
    const { folder, databasePath } = populatedSource();
    const original = fs.readFileSync(databasePath);
    const destination = path.join(folder, 'project-database-backups');
    fs.mkdirSync(destination, { mode: 0o500 });
    try {
      expect(() => createProjectDatabasePreMigrationBackup(databasePath)).toThrow(expect.objectContaining({
        code: 'PROJECT_DATA046', issues: expect.any(Array),
      }));
      expect(fs.readFileSync(databasePath)).toEqual(original);
    } finally { fs.chmodSync(destination, 0o700); }
    expect(createProjectDatabasePreMigrationBackup(databasePath)?.backupPath).toBeTruthy();
  });
}
