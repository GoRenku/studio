import assert from 'node:assert/strict';
import test from 'node:test';
import { openCodexAppServer } from './fixtures/native-codex-app-server.mjs';
import { codexAppServerFixture } from './fixtures/codex-app-server.mjs';

test('initializes before skill calls and closes its child process', async () => {
  const state = { skills: [] };
  const child = codexAppServerFixture(state);
  const server = await openCodexAppServer(() => child);
  assert.deepEqual(await server.request('skills/list', { cwds: ['/home'] }), { data: [{ cwd: '/home', skills: [], errors: [] }] });
  await server.close();
  assert.deepEqual(state.requests.map((entry) => entry.method), ['initialize', 'initialized', 'skills/list']);
  assert.equal(child.exitCode, 0);
});

for (const state of [{ hang: true }, { invalidJson: true }, { failMethod: 'initialize' }]) {
  test(`bounds protocol failures and closes the process: ${JSON.stringify(state)}`, async () => {
    const child = codexAppServerFixture(state);
    await assert.rejects(openCodexAppServer(() => child, { timeoutMs: 20 }), /INSTALL012/);
    assert.equal(child.exitCode, 0);
  });
}
