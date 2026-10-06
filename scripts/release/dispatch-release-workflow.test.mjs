import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchAndWaitForRelease } from './dispatch-release-workflow.mjs';

function harness({ existing = [], conclusion = 'success' } = {}) {
  const calls = [];
  let dispatched = false;
  const command = (binary, args) => {
    calls.push([binary, args]);
    if (binary === 'git' && args[0] === 'rev-parse') { return { stdout: 'commit\n' }; }
    if (args[0] === 'run' && args[1] === 'list') {
      return { stdout: JSON.stringify(dispatched ? [{ databaseId: 4, headSha: 'commit', status: 'queued', url: 'run-url' }] : existing) };
    }
    if (args[0] === 'workflow') { dispatched = true; return { stdout: '' }; }
    if (args[0] === 'run' && args[1] === 'view') {
      return { stdout: JSON.stringify({ databaseId: 4, headSha: 'commit', status: 'completed', conclusion, url: 'run-url' }) };
    }
    if (args[0] === 'release') { return { stdout: JSON.stringify({ tagName: 'v0.1.26', url: 'release-url', isDraft: false }) }; }
    return { stdout: '' };
  };
  return { calls, command, delay: async () => {} };
}
test('publish waits for native workflow success before reporting the published release', async () => {
  const h = harness();
  assert.equal((await dispatchAndWaitForRelease('v0.1.26', h)).url, 'release-url');
  assert.ok(h.calls.some(([, args]) => args[0] === 'workflow'));
  assert.ok(h.calls.some(([, args]) => args[0] === 'run' && args[1] === 'view'));
});
test('publish resumes an existing workflow rather than rebuilding local artifacts', async () => {
  const h = harness({ existing: [{ databaseId: 4, headSha: 'commit', status: 'in_progress' }] });
  await dispatchAndWaitForRelease('v0.1.26', h);
  assert.ok(!h.calls.some(([, args]) => args[0] === 'workflow'));
});
test('publish retries only failed jobs and waits for the new attempt', async () => {
  const h = harness({ existing: [{ databaseId: 4, headSha: 'commit', status: 'completed', conclusion: 'failure' }] });
  let rerun = false;
  let polls = 0;
  const command = (binary, args) => {
    if (args[0] === 'run' && args[1] === 'rerun') { rerun = true; }
    if (args[0] === 'run' && args[1] === 'view') {
      h.calls.push([binary, args]);
      if (args.at(-1) === 'attempt') { return { stdout: JSON.stringify({ attempt: 1 }) }; }
      polls++;
      return { stdout: JSON.stringify({ headSha: 'commit', status: 'completed', conclusion: polls === 1 ? 'failure' : 'success',
        attempt: polls === 1 ? 1 : 2, url: 'run-url' }) };
    }
    return h.command(binary, args);
  };
  await dispatchAndWaitForRelease('v0.1.26', { ...h, command });
  assert.equal(rerun, true);
  assert.equal(polls, 2);
  assert.ok(h.calls.some(([, args]) => args[0] === 'run' && args[1] === 'rerun' && args.at(-1) === '--failed'));
  assert.ok(!h.calls.some(([, args]) => args[0] === 'workflow'));
});
test('dry run makes no remote mutations and does not claim native evidence', async () => {
  const h = harness();
  await dispatchAndWaitForRelease('v0.1.26', { ...h, dryRun: true });
  assert.deepEqual(h.calls, [['git', ['rev-parse', 'v0.1.26^{commit}']]]);
});
test('a failed native workflow blocks publication', async () => {
  const h = harness({ conclusion: 'failure' });
  await assert.rejects(dispatchAndWaitForRelease('v0.1.26', h), /RELEASE020.*failure/);
  assert.ok(!h.calls.some(([, args]) => args[0] === 'release'));
});
test('a workflow that never appears times out with a resumable tag', async () => {
  let time = 0;
  const command = (binary, args) => ({ stdout: binary === 'git' && args[0] === 'rev-parse' ? 'commit' : '[]' });
  await assert.rejects(dispatchAndWaitForRelease('v0.1.26', { command, timeoutMs: 2, now: () => time++, delay: async () => {} }), /RELEASE020.*Timed out.*v0.1.26/);
});
