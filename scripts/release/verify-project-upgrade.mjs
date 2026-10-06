import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertImmutableMigrationHistory, fixtureForProduct, releaseIdentity, verifyExtractedArchive } from './upgrades/fixtures.mjs';
import { assertJournalComplete, assertPreserved, observeProject } from './upgrades/preservation.mjs';
import { verifyProcessLifecycle } from './upgrades/process-lifecycle.mjs';
import { requiredUpgradeChecks } from './upgrades/evidence.mjs';
import { requireReleaseTarget, targetNodeExecutable } from './release-targets.mjs';

function run(node, args, cwd, env, timeout = 120_000) {
  const result = spawnSync(node, args, { cwd, env, encoding: 'utf8', timeout });
  if (result.status !== 0) { throw new Error(`RELEASE020 Packaged upgrade command failed: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`); }
  return result.stdout;
}
export function isolatedEnvironment(home) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, '.config'),
    APPDATA: path.join(home, 'AppData/Roaming'), LOCALAPPDATA: path.join(home, 'AppData/Local'),
    FLATPAK_XDG_CONFIG_HOME: path.join(home, '.config') };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  delete env.RENKU_PROJECT_DATABASE_PATH;
  delete env.RENKU_PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH;
  return env;
}
export async function verifyProjectUpgrade(sourceProduct, targetProduct, reportPath) {
  writeFileSync(reportPath, JSON.stringify({ result: 'running' }));
  const target = releaseIdentity(targetProduct);
  const source = releaseIdentity(sourceProduct);
  if (target.target !== `${process.platform}-${process.arch}` || source.target !== target.target) {
    throw new Error('RELEASE020 Project upgrades require the source and candidate native target.');
  }
  const targetNode = targetNodeExecutable(path.join(targetProduct, 'runtime/node'), requireReleaseTarget(target.target));
  if (realpathSync(process.execPath) !== realpathSync(targetNode)) {
    run(targetNode, [fileURLToPath(import.meta.url), '--source-product', sourceProduct, '--target-product', targetProduct, '--report', reportPath], os.tmpdir(), process.env, 600_000);
    return JSON.parse(readFileSync(reportPath, 'utf8'));
  }
  const evidenceRoot = mkdtempSync(path.join(os.tmpdir(), 'studio-project-upgrade-'));
  const env = isolatedEnvironment(evidenceRoot);
  try {
    const fixture = fixtureForProduct(sourceProduct);
    const archiveSha256 = verifyExtractedArchive(targetProduct);
    assertImmutableMigrationHistory(sourceProduct, targetProduct);
    const sourceNode = targetNodeExecutable(path.join(sourceProduct, 'runtime/node'), requireReleaseTarget(source.target));
    const sourceCli = path.join(sourceProduct, 'app/dist/cli.js');
    const targetCli = path.join(targetProduct, 'app/dist/cli.js');
    run(sourceNode, [sourceCli, 'init', path.join(evidenceRoot, 'projects'), '--json'], evidenceRoot, env);
    const created = JSON.parse(run(sourceNode, [sourceCli, 'create', 'upgrade-fixture', '--title', "Upgrade Ω ' 雪", '--json'], evidenceRoot, env));
    const project = created.projectPath;
    const recipeUrl = new URL('./upgrades/recipe.mjs', import.meta.url).href;
    run(sourceNode, ['--input-type=module', '--eval', `import { populateProject } from ${JSON.stringify(recipeUrl)}; await populateProject(...${JSON.stringify([sourceProduct, project, fixture.schemaGeneration])});`], evidenceRoot, env);
    const before = observeProject(sourceProduct, project);
    assert.equal(before.generation, fixture.schemaGeneration);
    assertJournalComplete(sourceProduct, before);
    writeFileSync(path.join(evidenceRoot, 'before.json'), JSON.stringify(before, null, 2));
    const processLifecycle = await verifyProcessLifecycle({ sourceProduct, targetProduct, sourceNode, targetNode,
      project, evidenceRoot, before, environment: isolatedEnvironment });
    // The ordinary command exercises automatic open through the installed CLI.
    run(targetNode, [targetCli, 'info', 'show', '--project', 'upgrade-fixture', '--json'], evidenceRoot, env);
    let after = observeProject(targetProduct, project);
    assertJournalComplete(targetProduct, after);
    assertPreserved(before, after);
    const backups = path.join(project, '.renku/project-database-backups');
    const backupNames = existsSync(backups) ? readdirSync(backups).sort() : [];
    run(targetNode, [targetCli, 'info', 'show', '--project', 'upgrade-fixture', '--json'], evidenceRoot, env);
    assert.deepEqual(observeProject(targetProduct, project), after, 'Ordinary repeat open changed the Project');
    assert.deepEqual(existsSync(backups) ? readdirSync(backups).sort() : [], backupNames, 'Repeat open created another backup');
    // Explicit migration retains its safety backup even with no pending SQL.
    const migration = JSON.parse(run(targetNode, [targetCli, 'project', 'migrate', 'upgrade-fixture', '--json'], evidenceRoot, env));
    assert.ok(migration.preMigrationBackup?.backupPath);
    after = observeProject(targetProduct, project);
    assertPreserved(before, after);
    for (const name of readdirSync(backups).filter((name) => name.endsWith('.json'))) {
      const metadata = JSON.parse(readFileSync(path.join(backups, name), 'utf8'));
      const observed = observeProject(targetProduct, project, metadata.backupPath);
      assert.equal(observed.generation, metadata.sourceSchemaGeneration);
      if (metadata.sourceSchemaGeneration === before.generation && before.generation !== after.generation) {
        assert.deepEqual(observed.tables, before.tables, 'Pre-upgrade backup does not preserve the original database');
      }
    }
    if (before.generation !== after.generation) {
      assert.ok(readdirSync(backups).some((name) => name.endsWith('.json')
        && JSON.parse(readFileSync(path.join(backups, name), 'utf8')).sourceSchemaGeneration === before.generation), 'Missing original generation backup');
    }
    // Start the actual packaged HTTP server and load the populated Project.
    run(targetNode, ['--input-type=module', '--eval', `
      import { startMovieStudioServer } from '@gorenku/studio/server';
      import { createHash } from 'node:crypto';
      const server = await startMovieStudioServer({ distPath: ${JSON.stringify(path.join(targetProduct, 'app/node_modules/@gorenku/studio/dist'))}, port: 0 });
      try {
        for (const route of ['/', '/studio-api/health', '/studio-api/projects/upgrade-fixture',
          ...['screenplay/structure', 'screenplay/story-arc', 'screenplay/beat-gallery', 'visual-language/lookbooks']
            .map((route) => '/studio-api/projects/upgrade-fixture/' + route),
          ...${JSON.stringify(after.tables.scene.map(({ id }) => `/studio-api/projects/upgrade-fixture/screenplay/scenes/${encodeURIComponent(id)}/beats`))}]) {
          const response = await fetch(server.url + route);
          if (!response.ok) throw new Error(route + ': ' + response.status + ' ' + await response.text());
          if (route.endsWith('upgrade-fixture') && !(await response.json()).project) throw new Error('Project did not load');
        }
        for (const file of ${JSON.stringify(after.tables.asset_file.filter((file) => file.discarded_at === null
          && ['image', 'audio', 'video'].includes(file.media_kind)).map((file) => ({ id: file.id, hash: file.content_hash })))}) {
          const response = await fetch(server.url + '/studio-api/projects/upgrade-fixture/asset-files/' + encodeURIComponent(file.id));
          if (!response.ok) throw new Error('Media did not load: ' + file.id + ' ' + response.status + ' ' + await response.text());
          const hash = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
          if (hash !== file.hash) throw new Error('HTTP media bytes changed: ' + file.id);
        }
      } finally { await server.stop(); }
    `], path.join(targetProduct, 'app'), env);
    writeFileSync(path.join(evidenceRoot, 'after.json'), JSON.stringify(after, null, 2));
    const report = { product: 'renku', version: target.version, target: target.target, level: 'runtime',
      studioHttpStartup: 'passed', archiveSha256, verifier: `${process.platform}-${process.arch}`, verifiedAt: new Date().toISOString(),
      projectUpgrades: [{ sourceVersion: source.version, sourceArchiveSha256: fixture.archiveSha256,
        sourceSchemaGeneration: before.generation, targetSchemaGeneration: after.generation, fixtureId: fixture.fixtureId,
        checks: Object.fromEntries(requiredUpgradeChecks.map((check) => [check, 'passed'])), processLifecycle, result: 'passed' }], evidenceRoot };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    writeFileSync(reportPath, `${JSON.stringify({ result: 'failed', evidenceRoot, message: String(error) }, null, 2)}\n`);
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const value = (name) => process.argv[process.argv.indexOf(name) + 1];
  try {
    for (const name of ['--source-product', '--target-product', '--report']) {
      if (!process.argv.includes(name) || !value(name) || value(name).startsWith('--')) {
        throw new Error('RELEASE020 Usage: verify-project-upgrade.mjs --source-product <extracted-source> --target-product <extracted-candidate> --report <report.json>');
      }
    }
    await verifyProjectUpgrade(path.resolve(value('--source-product')), path.resolve(value('--target-product')), path.resolve(value('--report')));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
