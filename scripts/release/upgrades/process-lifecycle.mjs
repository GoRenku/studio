import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertJournalComplete, assertPreserved, observeProject } from './preservation.mjs';
import { coreRoot } from './fixtures.mjs';
import { interruptSqlTransaction } from './sql-interruption.mjs';

function command(node, args, env, cwd) {
  const result = spawnSync(node, args, { env, cwd, encoding: 'utf8', timeout: 120_000 });
  assert.equal(result.status, 0, `RELEASE020 ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result;
}
function launch(node, args, env, cwd, ipc = false) {
  const child = spawn(node, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe', ...(ipc ? ['ipc'] : [])] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, output }); });
  });
  return { child, completion };
}
async function milestone(process) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RELEASE020 Upgrade milestone was not reached')), 120_000);
    process.child.once('message', (message) => { clearTimeout(timer); resolve(message); });
    process.completion.then((result) => { clearTimeout(timer); reject(new Error(`RELEASE020 Exited before milestone: ${result.output}`)); });
  });
}
export async function verifyProcessLifecycle({ sourceProduct, targetProduct, sourceNode, targetNode, project,
  evidenceRoot, before, environment }) {
  const targetCli = path.join(targetProduct, 'app/dist/cli.js');
  const cases = [];
  const clone = (name, initializer = targetNode) => {
    const home = path.join(evidenceRoot, name);
    mkdirSync(home, { recursive: true });
    const env = environment(home);
    const storage = path.join(home, 'projects');
    const cli = initializer === sourceNode ? path.join(sourceProduct, 'app/dist/cli.js') : targetCli;
    command(initializer, [cli, 'init', storage, '--json'], env, home);
    const folder = path.join(storage, 'upgrade-fixture');
    cpSync(project, folder, { recursive: true });
    return { home, env, folder };
  };
  const assertReady = (copy, expected = before) => {
    command(targetNode, [targetCli, 'info', 'show', '--project', 'upgrade-fixture', '--json'], copy.env, copy.home);
    const after = observeProject(targetProduct, copy.folder);
    assertJournalComplete(targetProduct, after);
    assertPreserved(expected, after);
  };
  const concurrent = clone('concurrent-opens');
  const openArgs = [targetCli, 'info', 'show', '--project', 'upgrade-fixture', '--json'];
  const competing = await Promise.all([launch(targetNode, openArgs, concurrent.env, concurrent.home).completion,
    launch(targetNode, [targetCli, 'project', 'migrate', 'upgrade-fixture', '--json'], concurrent.env, concurrent.home).completion]);
  assert.ok(competing.some(({ code }) => code === 0), `RELEASE020 Both competing opens failed: ${JSON.stringify(competing)}`);
  for (const result of competing.filter(({ code }) => code !== 0)) {
    const failure = JSON.parse(result.output);
    assert.ok(failure.error?.code?.startsWith('PROJECT_'), 'Contention did not report a structured bounded failure');
  }
  assertReady(concurrent);
  cases.push({ case: 'concurrent-open-and-migrate', result: 'passed' });
  const twoOpens = clone('concurrent-cli-opens');
  const opens = await Promise.all([launch(targetNode, openArgs, twoOpens.env, twoOpens.home).completion,
    launch(targetNode, openArgs, twoOpens.env, twoOpens.home).completion]);
  assert.ok(opens.some(({ code }) => code === 0), `RELEASE020 Both CLI opens failed: ${JSON.stringify(opens)}`);
  for (const result of opens.filter(({ code }) => code !== 0)) {
    assert.ok(JSON.parse(result.output).error?.code?.startsWith('PROJECT_'), 'CLI contention was not structured');
  }
  assertReady(twoOpens);
  cases.push({ case: 'concurrent-cli-opens', result: 'passed' });
  const studioAndCli = clone('concurrent-studio-and-cli');
  const studio = launch(targetNode, ['--input-type=module', '--eval', `
    import { startMovieStudioServer } from '@gorenku/studio/server';
    const server = await startMovieStudioServer({ distPath: ${JSON.stringify(path.join(targetProduct, 'app/node_modules/@gorenku/studio/dist'))}, port: 0 });
    try {
      const response = await fetch(server.url + '/studio-api/projects/upgrade-fixture');
      const payload = await response.json();
      if (!response.ok) { console.log(JSON.stringify(payload)); process.exitCode = 1; }
      else if (!payload.project) { throw new Error('Concurrent Studio open did not load the Project'); }
    } finally { await server.stop(); }
  `], studioAndCli.env, path.join(targetProduct, 'app'));
  const mixed = await Promise.all([studio.completion,
    launch(targetNode, openArgs, studioAndCli.env, studioAndCli.home).completion]);
  assert.ok(mixed.some(({ code }) => code === 0), `RELEASE020 Studio and CLI both failed: ${JSON.stringify(mixed)}`);
  for (const result of mixed.filter(({ code }) => code !== 0)) {
    assert.ok(JSON.parse(result.output).error?.code?.startsWith('PROJECT_'), 'Studio/CLI contention was not structured');
  }
  assertReady(studioAndCli);
  cases.push({ case: 'concurrent-studio-and-cli', result: 'passed' });

  const interruptedSql = clone('interrupt-sql-transaction');
  await interruptSqlTransaction({ product: targetProduct, node: targetNode, cli: targetCli, copy: interruptedSql,
    schemaChanges: before.generation !== observeProject(targetProduct, concurrent.folder).generation });
  assertReady(interruptedSql);
  cases.push({ case: 'interruption-sql-transaction', result: 'passed' });

  const wrapper = path.join(evidenceRoot, 'upgrade-barrier.mjs');
  writeFileSync(wrapper, `
    import fs from 'node:fs';
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    import { pathToFileURL } from 'node:url';
    const [cli, mode, resume] = process.argv.slice(2);
    const handles = new Map();
    function barrier() {
      process.send({ milestone: mode });
      const clock = new Int32Array(new SharedArrayBuffer(4));
      const deadline = Date.now() + 120000;
      while (!fs.existsSync(resume)) {
        if (Date.now() > deadline) throw new Error('Barrier timed out');
        Atomics.wait(clock, 0, 0, 20);
      }
    }
    const open = fs.openSync;
    fs.openSync = (...args) => { const fd = open(...args); handles.set(fd, String(args[0])); return fd; };
    const sync = fs.fsyncSync;
    fs.fsyncSync = (fd) => {
      const result = sync(fd);
      if (mode === 'partial-backup' && handles.get(fd)?.endsWith('.partial.sqlite')) barrier();
      return result;
    };
    const rename = fs.renameSync;
    fs.renameSync = (...args) => {
      if (mode === 'metadata-before-publication' && String(args[0]).endsWith('.partial.json')) barrier();
      const result = rename(...args);
      if (mode === 'backup-before-metadata' && String(args[0]).endsWith('.partial.sqlite')) barrier();
      if (mode === 'backup-published' && String(args[0]).endsWith('.partial.json')) barrier();
      return result;
    };
    const { createRequire } = await import('node:module');
    const require = createRequire(${JSON.stringify(path.join(coreRoot(targetProduct), 'package.json'))});
    const Database = require('better-sqlite3');
    const prepare = Database.prototype.prepare;
    Database.prototype.prepare = function (sql) {
      const statement = prepare.call(this, sql);
      const run = statement.run;
      statement.run = function (...args) {
        const result = run.apply(this, args);
        if (mode === 'registration-write' && /^update "project" set "asset_file_backfill_version"/i.test(sql)) barrier();
        return result;
      };
      return statement;
    };
    const transaction = Database.prototype.transaction;
    Database.prototype.transaction = function (callback) {
      const execute = transaction.call(this, callback);
      const wrapped = (...args) => execute(...args);
      for (const behavior of ['deferred', 'immediate', 'exclusive']) {
        wrapped[behavior] = (...args) => {
          const result = execute[behavior](...args);
          if (mode === 'registration-committed' && behavior === 'immediate') barrier();
          return result;
        };
      }
      return wrapped;
    };
    const spawn = childProcess.spawnSync;
    childProcess.spawnSync = (...args) => {
      const result = spawn(...args);
      if (mode === 'sql-completed' && args[1]?.includes('migrate') && result.status === 0) barrier();
      return result;
    };
    syncBuiltinESMExports();
    const { runRenkuCli } = await import(pathToFileURL(cli));
    process.exitCode = await runRenkuCli(['project', 'migrate', 'upgrade-fixture', '--json']);
  `);
  for (const mode of ['partial-backup', 'backup-before-metadata', 'metadata-before-publication',
    'backup-published', 'sql-completed', 'registration-write', 'registration-committed']) {
    const copy = clone(`interrupt-${mode}`);
    const resume = path.join(copy.home, 'resume');
    if (before.generation >= 71 && mode.startsWith('registration-')) {
      command(targetNode, ['--input-type=module', '--eval', `
        import { createRequire } from 'node:module';
        const Database = createRequire(${JSON.stringify(path.join(coreRoot(targetProduct), 'package.json'))})('better-sqlite3');
        const db = new Database(${JSON.stringify(path.join(copy.folder, '.renku/project.sqlite'))});
        db.prepare('update project set asset_file_backfill_version = 0').run(); db.close();
      `], copy.env, copy.home);
    }
    const running = launch(targetNode, [wrapper, targetCli, mode, resume], copy.env, copy.home, true);
    try {
      assert.deepEqual(await milestone(running), { milestone: mode });
    } finally { running.child.kill('SIGKILL'); }
    await running.completion;
    const failed = path.join(evidenceRoot, 'interrupted-evidence', mode);
    mkdirSync(failed, { recursive: true });
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const file = path.join(copy.folder, '.renku', `project.sqlite${suffix}`);
      if (existsSync(file)) { cpSync(file, path.join(failed, `project.sqlite${suffix}`)); }
    }
    assertReady(copy);
    cases.push({ case: `interruption-${mode}`, result: 'passed' });
  }

  const recovery = clone('manual-recovery');
  command(targetNode, [targetCli, 'project', 'migrate', 'upgrade-fixture', '--json'], recovery.env, recovery.home);
  const backupDirectory = path.join(recovery.folder, '.renku/project-database-backups');
  const metadata = readdirSync(backupDirectory).filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(path.join(backupDirectory, name), 'utf8')))
    .find((report) => report.sourceSchemaGeneration === before.generation);
  assert.ok(metadata, 'Recovery lacks an independently verified source backup');
  const failedDatabase = path.join(recovery.folder, '.renku/project.sqlite');
  const writer = spawnSync(targetNode, ['--input-type=module', '--eval', `
    import { createRequire } from 'node:module';
    const Database = createRequire(${JSON.stringify(path.join(coreRoot(targetProduct), 'package.json'))})('better-sqlite3');
    const db = new Database(${JSON.stringify(failedDatabase)});
    db.pragma('journal_mode = WAL'); db.pragma('wal_autocheckpoint = 0');
    db.prepare('update project set title = ?').run('Synthetic failed WAL evidence');
    process.kill(process.pid, 'SIGKILL');
  `], { env: recovery.env, cwd: recovery.home, encoding: 'utf8', timeout: 120_000 });
  assert.notEqual(writer.status, 0);
  assert.ok(existsSync(`${failedDatabase}-wal`), 'The recovery rehearsal did not retain a WAL-bearing failed database');
  const retainedWal = readFileSync(`${failedDatabase}-wal`);
  const restored = clone('restored-clean-location', sourceNode);
  // The failed database and all of its sidecars stay untouched in manual-recovery.
  // A clean destination contains only the verified standalone backup, never old WAL/SHM.
  cpSync(metadata.backupPath, path.join(restored.folder, '.renku/project.sqlite'));
  assert.deepEqual(observeProject(sourceProduct, restored.folder).tables, before.tables, 'Manual restoration changed the source');
  assert.deepEqual(readFileSync(`${failedDatabase}-wal`), retainedWal, 'Recovery changed the failed WAL evidence');
  command(sourceNode, [path.join(sourceProduct, 'app/dist/cli.js'), 'info', 'show', '--project', 'upgrade-fixture', '--json'], restored.env, restored.home);
  cases.push({ case: 'manual-restore-compatible-runtime', result: 'passed' });

  const racing = clone('writer-after-backup');
  const resume = path.join(racing.home, 'resume');
  const running = launch(targetNode, [wrapper, targetCli, 'backup-published', resume], racing.env, racing.home, true);
  try {
    await milestone(running);
    const database = path.join(racing.folder, '.renku/project.sqlite');
    command(sourceNode, ['--input-type=module', '--eval', `
      import { createRequire } from 'node:module';
      const require = createRequire(${JSON.stringify(path.join(coreRoot(sourceProduct), 'package.json'))});
      const Database = require('better-sqlite3'); const db = new Database(${JSON.stringify(database)});
      db.prepare('update project set title = ?').run("Acknowledged writer Ω ' 雪"); db.close();
    `], racing.env, racing.home);
    const acknowledged = observeProject(sourceProduct, racing.folder);
    writeFileSync(resume, 'continue');
    const result = await running.completion;
    assert.equal(result.code, 0, result.output);
    assertReady(racing, acknowledged);
  } finally { running.child.kill('SIGKILL'); }
  cases.push({ case: 'acknowledged-writer-after-backup', result: 'passed' });
  return cases;
}
