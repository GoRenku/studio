import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { coreRoot } from './fixtures.mjs';

export async function interruptSqlTransaction({ product, node, cli, copy, schemaChanges }) {
  const signal = path.join(copy.home, 'sql-milestone.json');
  const hook = path.join(copy.home, 'sql-interruption.cjs');
  let deliver;
  const server = createServer((socket) => {
    let message = '';
    socket.on('data', (chunk) => { message += chunk; });
    socket.on('end', () => deliver(JSON.parse(message)));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  writeFileSync(hook, `
    const fs = require('node:fs');
    const Database = require(require.resolve('better-sqlite3', { paths: [${JSON.stringify(coreRoot(product))}] }));
    let sent = false;
    function reached(db, sql) {
      if (sent || !db.inTransaction || (${schemaChanges} && !/\\b(?:CREATE|ALTER|DROP|INSERT|UPDATE)\\b/i.test(sql))) return;
      sent = true;
      fs.writeFileSync(${JSON.stringify(`${signal}.partial`)}, JSON.stringify({ pid: process.pid, transaction: true }));
      fs.renameSync(${JSON.stringify(`${signal}.partial`)}, ${JSON.stringify(signal)});
      const sender = require('node:child_process').spawnSync(process.execPath, ['-e',
        "const net = require('node:net'); const socket = net.connect(" + ${server.address().port} + ", '127.0.0.1', () => socket.end(" + JSON.stringify(JSON.stringify({ pid: process.pid, transaction: true })) + ")); socket.on('error', () => process.exit(1));"
      ], { env: { ...process.env, NODE_OPTIONS: '' }, timeout: 10000 });
      if (sender.status !== 0) throw new Error('SQL milestone sender failed');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120000);
      throw new Error('SQL interruption barrier timed out');
    }
    const exec = Database.prototype.exec;
    Database.prototype.exec = function(sql) { const result = exec.call(this, sql); reached(this, sql); return result; };
    const prepare = Database.prototype.prepare;
    Database.prototype.prepare = function(sql) {
      const statement = prepare.call(this, sql), db = this, run = statement.run;
      statement.run = function(...args) { const result = run.apply(this, args); reached(db, sql); return result; };
      return statement;
    };
  `);
  let child;
  let output = '';
  let timer;
  const milestone = new Promise((resolve, reject) => {
    deliver = resolve;
    timer = setTimeout(() => reject(new Error('RELEASE020 SQL transaction milestone was not reached')), 120_000);
    child = spawn(node, [cli, 'project', 'migrate', 'upgrade-fixture', '--json'], {
      cwd: copy.home, env: { ...copy.env, NODE_OPTIONS: `--require ${JSON.stringify(hook)}` }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', () => reject(new Error(`RELEASE020 Exited before SQL milestone: ${output}`)));
  });
  const completion = new Promise((resolve) => child.once('close', (code) => resolve(code)));
  try {
    const reached = await milestone;
    assert.equal(reached.transaction, true);
    process.kill(reached.pid, 'SIGKILL');
    assert.notEqual(await completion, 0, 'Killed SQL transaction unexpectedly reported success');
    const failure = JSON.parse(output);
    assert.equal(failure.error.code, 'PROJECT_DATA042');
    writeFileSync(path.join(copy.home, 'interruption-result.json'), JSON.stringify(failure, null, 2));
  } finally {
    clearTimeout(timer);
    server.close();
    child.kill('SIGKILL');
  }
}
