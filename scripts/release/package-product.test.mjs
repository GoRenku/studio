import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packager = fileURLToPath(new URL('./package-product.mjs', import.meta.url));

function fixture(isolated = false) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-windows-archive-'));
  const product = path.join(root, 'product', 'renku');
  const app = path.join(product, 'app');
  const modules = path.join(app, 'node_modules');
  const diagnostics = isolated
    ? path.join(modules, '.pnpm', 'diagnostics', 'node_modules', '@gorenku', 'studio-diagnostics')
    : path.join(modules, '@gorenku', 'studio-diagnostics');
  const dependency = isolated
    ? path.join(modules, '.pnpm', 'dependency', 'node_modules', 'dependency')
    : path.join(diagnostics, 'node_modules', 'dependency');
  mkdirSync(diagnostics, { recursive: true });
  mkdirSync(dependency, { recursive: true });
  mkdirSync(path.join(modules, '@gorenku'), { recursive: true });
  writeFileSync(path.join(product, 'RELEASE.json'), JSON.stringify({ version: '0.0.1', target: 'win32-x64' }));
  writeFileSync(path.join(app, 'package.json'), '{"type":"module"}');
  writeFileSync(path.join(app, 'cli.js'), "import value from '@gorenku/studio-diagnostics'; console.log(value);");
  writeFileSync(path.join(diagnostics, 'package.json'), '{"name":"@gorenku/studio-diagnostics","type":"module","exports":"./index.js"}');
  writeFileSync(path.join(diagnostics, 'index.js'), "export { default } from 'dependency';");
  writeFileSync(path.join(dependency, 'package.json'), '{"name":"dependency","type":"module","exports":"./index.js"}');
  writeFileSync(path.join(dependency, 'index.js'), "export default 'dependency resolved';");
  if (isolated) {
    symlinkSync(path.relative(path.join(modules, '@gorenku'), diagnostics), path.join(modules, '@gorenku', 'studio-diagnostics'), 'dir');
    const nestedModules = path.join(modules, '.pnpm', 'diagnostics', 'node_modules');
    symlinkSync(path.relative(nestedModules, dependency), path.join(nestedModules, 'dependency'), 'dir');
  }
  mkdirSync(path.join(modules, '.bin'));
  symlinkSync('../@gorenku/studio-diagnostics/index.js', path.join(modules, '.bin', 'diagnostics'));
  const output = path.join(root, 'output');
  return { root, product, output };
}

test('Windows ZIP contains real dependency files that resolve after extraction', () => {
  const { root, product, output } = fixture();
  const packaged = spawnSync(process.execPath, [packager, path.dirname(product), output], { encoding: 'utf8' });
  assert.equal(packaged.status, 0, packaged.stderr);
  const archive = path.join(output, 'renku.zip');
  const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
  assert.equal(readFileSync(`${archive}.sha256`, 'utf8'), `${checksum}  renku.zip\n`);
  const extracted = path.join(root, 'extracted');
  mkdirSync(extracted);
  const unpacked = spawnSync('tar', ['-xf', archive, '-C', extracted], { encoding: 'utf8' });
  assert.equal(unpacked.status, 0, unpacked.stderr);
  const inspect = (folder) => {
    for (const name of readdirSync(folder)) {
      const entry = path.join(folder, name);
      const stat = lstatSync(entry);
      assert.equal(stat.isSymbolicLink(), false, entry);
      if (stat.isDirectory()) inspect(entry);
    }
  };
  inspect(extracted);
  const result = spawnSync(process.execPath, [path.join(extracted, 'renku', 'app', 'cli.js')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'dependency resolved');
});

test('Windows packaging rejects directory links before producing a broken archive', () => {
  const { product, output } = fixture(true);
  const result = spawnSync(process.execPath, [packager, path.dirname(product), output], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RELEASE011/);
});
