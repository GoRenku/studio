import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCodexCli } from '../../distribution/codex-cli.mjs';
import { openCodexAppServer } from '../../distribution/codex-app-server.mjs';
import { reconcileCodexSkills } from '../../distribution/reconcile-codex-skills.mjs';
import { installCodexPlugin } from '../../distribution/install-codex-plugin.mjs';

test('public Renku marketplace installs and updates through the installer', { skip: !process.env.RENKU_TEST_CODEX_EXECUTABLE || process.env.RENKU_TEST_CODEX_PUBLIC_MARKETPLACE !== '1' }, async () => {
  const home = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'renku-public-plugin-')));
  const env = { ...process.env, CODEX_HOME: home };
  for (const key of Object.keys(env).filter((key) => key.toUpperCase() === 'PATH')) delete env[key];
  env.PATH = `${path.dirname(process.env.RENKU_TEST_CODEX_EXECUTABLE)}${path.delimiter}${process.env.PATH || ''}`;
  const cli = createCodexCli({ env });
  const records = [];
  const reports = [];
  const options = { run: cli.plugin, record: async (installed) => records.push(installed), report: (message) => reports.push(message) };
  assert.equal(await installCodexPlugin(options), true, reports.join('\n'));
  assert.equal(await installCodexPlugin(options), true, reports.join('\n'));
  assert.deepEqual(records, [false, true, false, true]);
  const server = await openCodexAppServer(() => cli.startAppServer(home));
  try {
    const { data } = await server.request('skills/list', { cwds: [home], forceReload: true });
    assert.deepEqual(data[0].errors, []);
    assert.ok(data[0].skills.some((entry) => entry.pluginId === 'renku@renku' && entry.name === 'renku:movie-director' && entry.enabled));
  } finally {
    await server.close();
  }
});

test('native Codex disables standalone duplicates while retaining plugin skills and other harness files', { skip: !process.env.RENKU_TEST_CODEX_EXECUTABLE }, async () => {
  const home = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'renku-native-skills-')));
  const codexHome = path.join(home, 'custom codex');
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: codexHome, XDG_STATE_HOME: path.join(home, 'state'), LOCALAPPDATA: path.join(home, 'AppData/Local'), APPDATA: path.join(home, 'AppData/Roaming') };
  for (const key of Object.keys(env).filter((key) => key.toUpperCase() === 'PATH')) delete env[key];
  env.PATH = `${path.dirname(process.env.RENKU_TEST_CODEX_EXECUTABLE)}${path.delimiter}${process.env.PATH || ''}`;
  const write = (file, content) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  };
  const files = new Map();
  const skill = (root, name) => {
    const file = path.join(root, name, 'SKILL.md');
    const content = `---\nname: ${name}\ndescription: Native test.\n---\nNative test skill.\n`;
    write(file, content);
    files.set(file, content);
    return file;
  };
  const shared = skill(path.join(home, '.agents/skills'), 'movie-director');
  // Windows Codex resolves the real user home through Windows APIs, ignoring
  // HOME/USERPROFILE overrides. CODEX_HOME still provides an isolated user root.
  const standalone = process.platform === 'win32'
    ? skill(path.join(codexHome, 'skills'), 'movie-director')
    : shared;
  skill(path.join(home, '.claude/skills'), 'movie-director');
  skill(path.join(home, '.agents/skills'), 'unrelated');
  const config = path.join(codexHome, 'config.toml');
  write(config, '# User settings must survive\nmodel = "test-model"\n');
  write(path.join(env.XDG_STATE_HOME, 'skills/.skill-lock.json'), { version: 3, skills: { 'movie-director': { source: 'GoRenku/studio-skills', sourceType: 'github' } } });
  const marketplace = path.join(home, 'marketplace');
  write(path.join(marketplace, '.agents/plugins/marketplace.json'), { name: 'renku', plugins: [{ name: 'renku', source: { source: 'local', path: './renku' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' } }] });
  write(path.join(marketplace, 'renku/.codex-plugin/plugin.json'), { name: 'renku', version: '0.1.0', description: 'Native test', skills: './skills/' });
  skill(path.join(marketplace, 'renku/skills'), 'movie-director');
  const cli = createCodexCli({ env });
  cli.plugin(['marketplace', 'add', marketplace, '--json']);
  const installed = cli.plugin(['add', 'renku@renku', '--json']);
  const pluginFile = path.join(installed.installedPath, 'skills/movie-director/SKILL.md');
  files.set(pluginFile, readFileSync(pluginFile, 'utf8'));
  // The offline fixture substitutes marketplace provenance only; the installed
  // plugin, skill inventory, configuration writes, and reload are real Codex.
  const fixtureCli = {
    ...cli,
    plugin(args) {
      if (args[0] === 'marketplace') return { marketplaces: [{ name: 'renku', marketplaceSource: { sourceType: 'git', source: 'https://github.com/GoRenku/studio-skills.git' } }] };
      return cli.plugin(args);
    },
  };
  assert.equal(await reconcileCodexSkills({ cli: fixtureCli, home, env, report() {} }), 1);
  assert.equal(await reconcileCodexSkills({ cli: fixtureCli, home, env, report() {} }), 0);
  const server = await openCodexAppServer(() => cli.startAppServer(home));
  try {
    const { data } = await server.request('skills/list', { cwds: [home], forceReload: true });
    assert.equal(data[0].skills.find((entry) => entry.path === realpathSync(standalone)).enabled, false);
    if (process.platform === 'win32') assert.equal(data[0].skills.find((entry) => entry.path === realpathSync(shared)).enabled, true);
    assert.equal(data[0].skills.find((entry) => entry.pluginId === 'renku@renku' && entry.name === 'renku:movie-director').enabled, true);
    assert.equal(data[0].skills.find((entry) => entry.name === 'unrelated').enabled, true);
  } finally {
    await server.close();
  }
  for (const [file, content] of files) assert.equal(readFileSync(file, 'utf8'), content);
  const saved = readFileSync(config, 'utf8');
  assert.match(saved, /# User settings must survive/);
  assert.match(saved, /model = "test-model"/);
});
