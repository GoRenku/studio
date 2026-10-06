import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractVerifiedArchive, releaseIdentity, sha256File, upgradeFixtures } from './upgrades/fixtures.mjs';
import { validateNativeUpgradeEvidence } from './upgrades/evidence.mjs';
import { verifyProjectUpgrade } from './verify-project-upgrade.mjs';
import { verifyProduct } from './verify-product.mjs';

function saveDatabaseEvidence(folder, destination) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const sourcePath = path.join(folder, entry.name);
    if (entry.isDirectory()) { saveDatabaseEvidence(sourcePath, path.join(destination, entry.name)); }
    else if (/\.(sqlite(?:-(?:wal|shm|journal))?|json)$/.test(entry.name)) {
      mkdirSync(destination, { recursive: true });
      cpSync(sourcePath, path.join(destination, entry.name));
    }
  }
}

export async function verifyReleaseUpgrades(archive, reportPath) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ result: 'running' }));
  const root = mkdtempSync(path.join(os.tmpdir(), 'studio-native-release-'));
  const archiveSha256 = sha256File(archive);
  const candidate = extractVerifiedArchive(archive, archiveSha256, path.join(root, 'candidate'));
  const release = releaseIdentity(candidate);
  if (release.target !== `${process.platform}-${process.arch}`) {
    throw new Error('RELEASE020 Native archive verification requires its actual platform and architecture.');
  }
  const evidenceDirectory = path.join(path.dirname(reportPath), 'upgrade-evidence');
  mkdirSync(evidenceDirectory, { recursive: true });
  const reports = [];
  try {
    await verifyProduct(candidate);
    for (const fixture of upgradeFixtures) {
      process.stdout.write(`Native ${release.target}: verifying ${fixture.sourceVersion} -> ${release.version} (${fixture.fixtureId}).\n`);
      const sourceRoot = path.join(root, fixture.fixtureId);
      mkdirSync(sourceRoot);
      const sourceArchive = fixture.archives[release.target];
      if (!sourceArchive) { throw new Error('RELEASE077 Required native source archive is missing from the inventory.'); }
      try {
        execFileSync('gh', ['release', 'download', `v${fixture.sourceVersion}`, '--pattern', sourceArchive.name, '--dir', sourceRoot],
          { stdio: 'inherit', timeout: 120_000 });
      } catch (error) {
        throw new Error(`RELEASE020 Required source archive download failed: ${fixture.sourceVersion}.`, { cause: error });
      }
      const source = extractVerifiedArchive(path.join(sourceRoot, sourceArchive.name), sourceArchive.sha256, path.join(sourceRoot, 'extracted'));
      const saved = path.join(evidenceDirectory, fixture.fixtureId);
      const fixtureReport = path.join(evidenceDirectory, `${fixture.fixtureId}.json`);
      let result;
      try {
        result = await verifyProjectUpgrade(source, candidate, fixtureReport);
      } finally {
        // Failed runs retain their synthetic database and sidecars as well as
        // the report; runner cleanup must not discard the recovery evidence.
        const evidence = JSON.parse(readFileSync(fixtureReport, 'utf8'));
        if (evidence.evidenceRoot) {
          mkdirSync(saved, { recursive: true });
          for (const name of ['before.json', 'after.json']) {
            const file = path.join(evidence.evidenceRoot, name);
            if (existsSync(file)) { cpSync(file, path.join(saved, name)); }
          }
          saveDatabaseEvidence(evidence.evidenceRoot, path.join(saved, 'databases'));
        }
      }
      reports.push(result);
      process.stdout.write(`Native ${release.target}: passed ${fixture.fixtureId}, including HTTP media and process recovery.\n`);
    }
    const report = { product: 'renku', version: release.version, target: release.target, level: 'runtime',
      archiveSha256, studioHttpStartup: 'passed', verifier: `${process.platform}-${process.arch}`,
      verifiedAt: new Date().toISOString(), projectUpgrades: reports.flatMap((report) => report.projectUpgrades) };
    validateNativeUpgradeEvidence(report, { target: release.target, version: release.version, archiveSha256 });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    // Replace any previously passing report so a rerun cannot publish stale success.
    writeFileSync(reportPath, `${JSON.stringify({ result: 'failed', root, message: String(error), completed: reports }, null, 2)}\n`);
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const value = (name) => args[args.indexOf(name) + 1];
    if (!args.includes('--archive') || !args.includes('--report') || !existsSync(value('--archive'))) {
      throw new Error('RELEASE020 Usage: verify-release-upgrades.mjs --archive <candidate-archive> --report <verification.json>');
    }
    await verifyReleaseUpgrades(path.resolve(value('--archive')), path.resolve(value('--report')));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
