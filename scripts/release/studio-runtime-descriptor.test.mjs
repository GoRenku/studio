import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveProductRuntimeDescriptorPath } from './upgrades/fixtures.mjs';

test('the rehearsal resolves each product descriptor through its public Core contract and isolated environment', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-descriptor-rehearsal-'));
  const environment = { ...process.env, XDG_STATE_HOME: path.join(root, 'isolated state') };
  for (const name of ['source release', 'candidate release']) {
    const product = path.join(root, name);
    const core = path.join(product, 'app/node_modules/@gorenku/studio-core');
    mkdirSync(core, { recursive: true });
    writeFileSync(path.join(core, 'package.json'), JSON.stringify({
      name: '@gorenku/studio-core', type: 'module', exports: { './server': './server-entry.js' },
    }));
    writeFileSync(path.join(core, 'server-entry.js'), `
      import path from 'node:path';
      export function resolveStudioRuntimeDescriptorPath() {
        return path.join(process.env.XDG_STATE_HOME, ${JSON.stringify(name)}, 'studio-runtime.json');
      }
    `);
    assert.equal(resolveProductRuntimeDescriptorPath(process.execPath, product, environment),
      path.join(environment.XDG_STATE_HOME, name, 'studio-runtime.json'));
  }
});
