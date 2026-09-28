import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requestR2, verifyPublicObject } from './publish-r2.mjs';

test('R2 public verification bounds stalled downloads and reports their failure', (context) => {
  let downloadPath;
  context.mock.method(childProcess, 'spawnSync', (command, args) => {
    assert.equal(command, 'curl');
    const option = (name) => args[args.indexOf(name) + 1];
    assert.equal(option('--connect-timeout'), '20');
    assert.equal(option('--max-time'), '600');
    assert.equal(option('--speed-limit'), '1024');
    assert.equal(option('--speed-time'), '30');
    assert.equal(option('--retry-max-time'), '600');
    downloadPath = option('--output');
    writeFileSync(downloadPath, 'partial download');
    return { status: 28, stderr: 'curl: (28) Operation too slow' };
  });

  assert.throws(
    () => verifyPublicObject('/unused-local-archive', 'studio/releases/test/renku.tar.gz'),
    /RELEASE045 Public verification download failed.*Operation too slow/
  );
  assert.equal(existsSync(path.dirname(downloadPath)), false);
});

test('R2 public verification still requires identical downloaded bytes', (context) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-r2-verification-test-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const archive = path.join(root, 'archive');
  writeFileSync(archive, 'release archive');
  let downloadedBytes = 'different archive';
  context.mock.method(childProcess, 'spawnSync', (_command, args) => {
    writeFileSync(args[args.indexOf('--output') + 1], downloadedBytes);
    return { status: 0, stderr: '' };
  });

  assert.throws(
    () => verifyPublicObject(archive, 'studio/releases/test/renku.tar.gz'),
    /RELEASE046 Public verification hash mismatch/
  );
  downloadedBytes = 'release archive';
  assert.doesNotThrow(() => verifyPublicObject(archive, 'studio/releases/test/renku.tar.gz'));
});

for (const transportError of [
  Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' }),
  new AggregateError([
    Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' }),
    Object.assign(new Error('Network unreachable'), { code: 'ENETUNREACH' }),
  ]),
]) {
  test(`R2 reports transport details for ${transportError.name}`, async (context) => {
    context.mock.method(https, 'request', () => {
      const request = new EventEmitter();
      request.end = () => queueMicrotask(() => request.emit('error', transportError));
      return request;
    });

    await assert.rejects(
      requestR2({ method: 'HEAD', key: '', headers: {} }, {
        accountId: 'test-account',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret',
      }),
      (error) => {
        assert.match(error.message, /RELEASE044 R2 transport failed for HEAD renku-downloads/);
        assert.equal(error.cause, transportError);
        for (const failure of transportError.errors ?? [transportError]) {
          assert.ok(error.message.includes(failure.code));
          assert.ok(error.message.includes(failure.message));
        }
        assert.ok(!error.message.includes('test-secret'));
        return true;
      }
    );
  });
}
