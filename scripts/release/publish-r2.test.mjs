import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import test from 'node:test';
import { requestR2 } from './publish-r2.mjs';

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
