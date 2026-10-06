import { upgradeFixtures } from './fixtures.mjs';

export const requiredProcessCases = ['concurrent-open-and-migrate', 'concurrent-cli-opens', 'concurrent-studio-and-cli',
  'interruption-sql-transaction', 'interruption-partial-backup',
  'interruption-backup-before-metadata', 'interruption-metadata-before-publication', 'interruption-backup-published',
  'interruption-sql-completed', 'interruption-registration-write', 'interruption-registration-committed',
  'manual-restore-compatible-runtime', 'acknowledged-writer-after-backup'];
export const requiredUpgradeChecks = ['journal', 'preservation', 'backupVerification', 'repeatOpen', 'mediaHttp'];

export function validateNativeUpgradeEvidence(report, expected) {
  const fail = () => { throw new Error(`RELEASE077 Missing, stale or invalid native upgrade evidence for ${expected.target}.`); };
  if (report?.product !== 'renku' || report.version !== expected.version || report.target !== expected.target
    || report.level !== 'runtime' || report.verifier !== expected.target
    || report.studioHttpStartup !== 'passed' || report.archiveSha256 !== expected.archiveSha256
    || !/^[a-f0-9]{64}$/.test(report.archiveSha256) || !Number.isFinite(Date.parse(report.verifiedAt))
    || !Array.isArray(report.projectUpgrades) || report.projectUpgrades.length !== upgradeFixtures.length) { fail(); }
  const seen = new Set();
  for (const fixture of upgradeFixtures) {
    const entry = report.projectUpgrades.find(({ fixtureId }) => fixtureId === fixture.fixtureId);
    if (!entry || seen.has(entry.fixtureId) || entry.result !== 'passed'
      || entry.sourceVersion !== fixture.sourceVersion
      || entry.sourceArchiveSha256 !== fixture.archives[expected.target]?.sha256
      || entry.sourceSchemaGeneration !== fixture.schemaGeneration
      || !Number.isInteger(entry.targetSchemaGeneration) || entry.targetSchemaGeneration < fixture.schemaGeneration
      || entry.targetSchemaGeneration !== report.projectUpgrades[0].targetSchemaGeneration) { fail(); }
    if (requiredUpgradeChecks.some((check) => entry.checks?.[check] !== 'passed')
      || !Array.isArray(entry.processLifecycle) || entry.processLifecycle.length !== requiredProcessCases.length
      || requiredProcessCases.some((name) => entry.processLifecycle.filter((entry) => entry.case === name && entry.result === 'passed').length !== 1)) { fail(); }
    seen.add(entry.fixtureId);
  }
}
