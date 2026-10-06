import assert from 'node:assert/strict';
import test from 'node:test';
import { requiredProcessCases, requiredUpgradeChecks, validateNativeUpgradeEvidence } from './upgrades/evidence.mjs';
import { upgradeFixtures } from './upgrades/fixtures.mjs';
const expected = { target: 'win32-x64', version: '0.1.26', archiveSha256: 'a'.repeat(64) };
const evidence = () => ({ product: 'renku', ...expected, level: 'runtime', verifier: expected.target,
  studioHttpStartup: 'passed', verifiedAt: '2026-10-06T12:00:00Z',
  projectUpgrades: upgradeFixtures.map((fixture) => ({ fixtureId: fixture.fixtureId,
    sourceVersion: fixture.sourceVersion, sourceArchiveSha256: fixture.archives[expected.target].sha256,
    sourceSchemaGeneration: fixture.schemaGeneration, targetSchemaGeneration: 71,
    checks: Object.fromEntries(requiredUpgradeChecks.map((check) => [check, 'passed'])),
    processLifecycle: requiredProcessCases.map((name) => ({ case: name, result: 'passed' })), result: 'passed' })),
});
test('complete archive-bound native evidence passes', () => validateNativeUpgradeEvidence(evidence(), expected));
for (const [name, mutate] of [
  ['structural only', (r) => { r.level = 'structural'; }],
  ['foreign verifier', (r) => { r.verifier = 'darwin-arm64'; }],
  ['HTTP untested', (r) => { r.studioHttpStartup = 'not-tested'; }],
  ['stale bytes', (r) => { r.archiveSha256 = 'b'.repeat(64); }],
  ['wrong version', (r) => { r.version = '0.1.25'; }],
  ['wrong target', (r) => { r.target = 'darwin-arm64'; }],
  ['missing case', (r) => { r.projectUpgrades.pop(); }],
  ['failed case', (r) => { r.projectUpgrades[0].result = 'failed'; }],
  ['tampered source', (r) => { r.projectUpgrades[0].sourceArchiveSha256 = 'c'.repeat(64); }],
  ['wrong source generation', (r) => { r.projectUpgrades[0].sourceSchemaGeneration++; }],
  ['wrong target generation', (r) => { r.projectUpgrades[0].targetSchemaGeneration++; }],
  ['duplicate case', (r) => { r.projectUpgrades[1] = r.projectUpgrades[0]; }],
  ['missing media check', (r) => { delete r.projectUpgrades[0].checks.mediaHttp; }],
  ['skipped interruption', (r) => { r.projectUpgrades[0].processLifecycle[0].result = 'skipped'; }],
  ['missing process case', (r) => { r.projectUpgrades[0].processLifecycle.pop(); }],
]) {
  test(`native upgrade verification rejects ${name}`, () => {
    const report = evidence(); mutate(report);
    assert.throws(() => validateNativeUpgradeEvidence(report, expected), /RELEASE077/);
  });
}
