import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyStudio } from './verify-product.mjs';

test('Studio verification rejects a process that exits without starting its own server', async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'renku-server-verification-'));
  const cli = path.join(home, 'cli.mjs');
  writeFileSync(cli, `
import { writeFileSync } from 'node:fs';
import path from 'node:path';
if (process.argv.includes('start')) {
  writeFileSync(path.join(process.env.HOME, 'environment.json'), JSON.stringify({
    home: process.env.HOME, profile: process.env.USERPROFILE,
    local: process.env.LOCALAPPDATA, config: process.env.XDG_CONFIG_HOME,
  }));
  console.log('No server was started');
} else {
  console.log(JSON.stringify({ server: { running: true, descriptor: { pid: 1 } } }));
}
`);
  await assert.rejects(verifyStudio(process.execPath, cli, home), /RELEASE022/);
  assert.deepEqual(JSON.parse(readFileSync(path.join(home, 'environment.json'), 'utf8')), {
    home, profile: home, local: path.join(home, 'AppData', 'Local'), config: path.join(home, '.config'),
  });
});
