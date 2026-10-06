import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { reconcileCodexSkills } from '../../distribution/reconcile-codex-skills.mjs';
import { codexAppServerFixture } from './fixtures/codex-app-server.mjs';

function fixture({ ready = true, enabled = true, official = true, customHome = false } = {}) {
  const home = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'renku-codex-skills-')));
  const codexHome = path.join(home, customHome ? 'custom codex' : '.codex');
  const env = { CODEX_HOME: codexHome };
  if (customHome) env.XDG_STATE_HOME = path.join(home, 'custom state');
  const lockPath = customHome ? path.join(env.XDG_STATE_HOME, 'skills/.skill-lock.json') : path.join(home, '.agents/.skill-lock.json');
  const files = new Map();
  const skills = [];
  function skill(root, name, { pluginId = null, active = true, scope = 'user', directory = name } = {}) {
    const file = path.join(root, directory, 'SKILL.md');
    mkdirSync(path.dirname(file), { recursive: true });
    const content = `---\nname: ${name}\ndescription: Test.\n---\nKeep these instructions.\n`;
    writeFileSync(file, content);
    files.set(file, content);
    skills.push({ name, path: file, pluginId, scope, enabled: active });
    return file;
  }
  const shared = skill(path.join(home, '.agents/skills'), 'movie-director');
  const codex = skill(path.join(codexHome, 'skills'), 'movie-director');
  skill(path.join(home, '.claude/skills'), 'movie-director');
  skill(path.join(home, '.agents/skills'), 'custom-skill');
  skill(path.join(home, '.agents/skills'), 'only-standalone');
  skill(path.join(home, '.agents/skills'), 'already-off', { active: false });
  const pluginRoot = path.join(codexHome, 'plugins/cache/renku/renku/1.0.0/skills');
  for (const name of ['movie-director', 'already-off', 'custom-skill']) {
    skill(pluginRoot, `renku:${name}`, { pluginId: 'renku@renku', directory: name });
  }
  const lock = { version: 3, skills: Object.fromEntries(['movie-director', 'only-standalone', 'already-off'].map((name) => [name, { source: 'GoRenku/studio-skills', sourceType: 'github' }])) };
  lock.skills['custom-skill'] = { source: 'someone/other-skills', sourceType: 'github' };
  mkdirSync(path.dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, JSON.stringify(lock));
  const state = { skills, requests: [] };
  let starts = 0;
  const cli = {
    plugin(args) {
      if (args[0] === 'list') return { installed: ready ? [{ pluginId: 'renku@renku', installed: true, enabled }] : [] };
      return { marketplaces: [{ name: 'renku', marketplaceSource: { sourceType: official ? 'git' : 'local', source: 'https://github.com/GoRenku/studio-skills.git' } }] };
    },
    startAppServer(cwd) { assert.equal(cwd, home); starts += 1; return codexAppServerFixture(state); },
  };
  return { home, env, lockPath, state, files, shared, codex, starts: () => starts, options: { cli, home, env, report() {} } };
}

for (const customHome of [false, true]) {
  test(`disables only managed standalone duplicates and retains files; custom profile=${customHome}`, async () => {
    const f = fixture({ customHome });
    assert.equal(await reconcileCodexSkills(f.options), 2);
    assert.deepEqual(f.state.writes.sort(), [f.shared, f.codex].sort());
    for (const [file, content] of f.files) assert.equal(readFileSync(file, 'utf8'), content);
    assert.ok(f.state.skills.filter((skill) => skill.pluginId).every((skill) => skill.enabled));
    assert.equal(await reconcileCodexSkills(f.options), 0);
    assert.equal(f.state.writes.length, 2);
  });
}

for (const options of [{ ready: false }, { enabled: false }, { official: false }]) {
  test(`leaves standalone skills enabled without a usable official plugin: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    assert.equal(await reconcileCodexSkills(f.options), 0);
    assert.equal(f.starts(), 0);
    assert.equal(f.state.writes, undefined);
  });
}

test('does not disable a same-name skill belonging to another plugin', async () => {
  const f = fixture();
  f.state.skills.find((skill) => skill.path === f.shared).pluginId = 'other@other';
  assert.equal(await reconcileCodexSkills(f.options), 1);
  assert.deepEqual(f.state.writes, [f.codex]);
});

test('does not disable an alias whose resolved path belongs to the plugin', async () => {
  const f = fixture();
  f.state.skills.find((skill) => skill.pluginId === 'renku@renku' && skill.name === 'renku:movie-director').path = f.shared;
  assert.equal(await reconcileCodexSkills(f.options), 1);
  assert.deepEqual(f.state.writes, [f.codex]);
});

test('does not disable a shared alias whose target is owned by another plugin', async () => {
  const f = fixture();
  f.state.skills.push({ ...f.state.skills.find((skill) => skill.path === f.shared), pluginId: 'other@other' });
  assert.equal(await reconcileCodexSkills(f.options), 1);
  assert.deepEqual(f.state.writes, [f.codex]);
});

for (const failure of ['load-errors', 'no-plugin-skills', 'write-rejected', 'write-ignored', 'rpc-error']) {
  test(`reports ${failure} without changing skill files`, async () => {
    const f = fixture();
    if (failure === 'load-errors') f.state.errors = [{ message: 'Bad skill' }];
    if (failure === 'no-plugin-skills') f.state.skills = f.state.skills.filter((skill) => !skill.pluginId);
    if (failure === 'write-rejected') f.state.rejectWrite = true;
    if (failure === 'write-ignored') f.state.ignoreWrite = true;
    if (failure === 'rpc-error') f.state.failMethod = 'skills/config/write';
    await assert.rejects(reconcileCodexSkills(f.options), /INSTALL012/);
    for (const [file, content] of f.files) assert.equal(readFileSync(file, 'utf8'), content);
  });
}

test('malformed installer records fail before configuration writes', async () => {
  const f = fixture();
  writeFileSync(f.lockPath, '{');
  await assert.rejects(reconcileCodexSkills(f.options), /INSTALL012/);
  assert.equal(f.starts(), 0);
});

test('a missing installer record makes no Codex calls', async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'renku-no-skills-'));
  assert.equal(await reconcileCodexSkills({ home, env: {}, cli: { plugin() { assert.fail('No Codex call expected'); } } }), 0);
});
