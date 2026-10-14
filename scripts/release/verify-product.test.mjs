import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertPackagedRelativeImports,
  assertStudioWebAssets,
  verifyStudioModule,
} from './verify-product.mjs';

function studioFixture(source) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'renku-server-verification-'));
  const app = path.join(home, 'app');
  const studio = path.join(app, 'node_modules', '@gorenku', 'studio');
  mkdirSync(studio, { recursive: true });
  writeFileSync(path.join(studio, 'package.json'), JSON.stringify({
    name: '@gorenku/studio', type: 'module', exports: { './server': './server.js' },
  }));
  writeFileSync(path.join(studio, 'server.js'), source);
  return { home, app, studio };
}

test('Studio module verification loads the package without starting a server and isolates configuration', () => {
  const { home, app } = studioFixture(`
import { writeFileSync } from 'node:fs';
import path from 'node:path';
writeFileSync(path.join(process.env.HOME, 'environment.json'), JSON.stringify({
  home: process.env.HOME, profile: process.env.USERPROFILE,
  local: process.env.LOCALAPPDATA, config: process.env.XDG_CONFIG_HOME,
}));
export function startMovieStudioServer() {
  throw new Error('Verification must not start Studio');
}
`);
  verifyStudioModule(process.execPath, app, home);
  assert.deepEqual(JSON.parse(readFileSync(path.join(home, 'environment.json'), 'utf8')), {
    home, profile: home, local: path.join(home, 'AppData', 'Local'), config: path.join(home, '.config'),
  });
});

for (const source of [
  "import './missing-dependency.js'; export function startMovieStudioServer() {}",
  'export const unrelated = true;',
]) {
  test(`Studio module verification rejects an incomplete package: ${source}`, () => {
    const { home, app } = studioFixture(source);
    assert.throws(() => verifyStudioModule(process.execPath, app, home), /RELEASE022/);
  });
}

test('Studio web verification requires the built HTML and populated asset directory', () => {
  const { app, studio } = studioFixture('');
  assert.throws(() => assertStudioWebAssets(app), /RELEASE022/);
  mkdirSync(path.join(studio, 'dist', 'assets'), { recursive: true });
  writeFileSync(path.join(studio, 'dist', 'index.html'), '<html></html>');
  assert.throws(() => assertStudioWebAssets(app), /RELEASE022/);
  writeFileSync(path.join(studio, 'dist', 'assets', 'index.js'), '');
  assertStudioWebAssets(app);
});

function packagedAppFixture() {
  const app = mkdtempSync(path.join(os.tmpdir(), 'renku-packaged-imports-'));
  const engines = path.join(app, 'node_modules', '@gorenku', 'studio-engines');
  mkdirSync(path.join(engines, 'dist', 'providers'), { recursive: true });
  mkdirSync(path.join(app, 'dist'), { recursive: true });
  writeFileSync(path.join(app, 'dist', 'cli.js'), "const load = () => import('./commands.js');\n");
  writeFileSync(path.join(app, 'dist', 'commands.js'), "export { run } from '@gorenku/studio-engines';\n");
  writeFileSync(path.join(engines, 'dist', 'index.js'), "export * from './providers/fal.js';\n");
  writeFileSync(path.join(engines, 'dist', 'providers', 'fal.js'), "import { estimate } from '../pricing/estimate.js';\nexport const run = estimate;\n");
  return { app, engines };
}

test('packaged import verification reports a module left out of a dependency package', () => {
  const { app } = packagedAppFixture();
  assert.throws(
    () => assertPackagedRelativeImports(app),
    /RELEASE095[\s\S]*studio-engines[\/\\]dist[\/\\]providers[\/\\]fal\.js -> \.\.\/pricing\/estimate\.js/
  );
});

test('packaged import verification accepts a complete package tree', () => {
  const { app, engines } = packagedAppFixture();
  mkdirSync(path.join(engines, 'dist', 'pricing'));
  writeFileSync(path.join(engines, 'dist', 'pricing', 'estimate.js'), 'export const estimate = 1;\n');
  assertPackagedRelativeImports(app);
});
