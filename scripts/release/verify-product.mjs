import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BUNDLED_NODE_VERSION,
  isHostReleaseTarget,
  requireReleaseTarget,
  targetNodeExecutable,
} from './release-targets.mjs';

export async function verifyProduct(productRoot) {
  const { release, target, nodeExecutable } = verifyProductStructure(productRoot);
  if (!isHostReleaseTarget(target)) {
    throw new Error(
      `RELEASE025 Runtime verification for ${target.id} requires a ${target.id} host.`
    );
  }
  const cliEntry = path.join(productRoot, 'app', 'dist', 'cli.js');
  const testHome = mkdtempSync(path.join(os.tmpdir(), 'renku-release-verify-'));

  const aboutOutput = run(nodeExecutable, [cliEntry, 'about']);
  assertAboutOutput(aboutOutput, release.version);
  run(nodeExecutable, [cliEntry, 'init', path.join(testHome, 'movies'), '--json'], testHome);
  run(nodeExecutable, [cliEntry, 'create', 'release-smoke', '--title', 'Release Smoke', '--json'], testHome);
  await verifyStudio(nodeExecutable, cliEntry, testHome);
  console.log(`Runtime verified Renku ${release.version} ${release.target}.`);
  return verificationReport(release, 'runtime');
}

export function verifyProductStructure(productRoot) {
  const releasePath = path.join(productRoot, 'RELEASE.json');
  if (!existsSync(releasePath)) {
    throw new Error('Usage: verify-product.mjs <renku-product-root>');
  }
  const release = JSON.parse(readFileSync(releasePath, 'utf8'));
  const target = requireReleaseTarget(release.target);
  if (
    release.runtime?.kind !== 'bundled-node' ||
    release.runtime?.nodeVersion !== BUNDLED_NODE_VERSION
  ) {
    throw new Error(`RELEASE025 Invalid bundled Node contract for ${target.id}.`);
  }
  const runtimeRoot = path.join(productRoot, 'runtime', 'node');
  const nodeExecutable = targetNodeExecutable(runtimeRoot, target);
  if (!existsSync(nodeExecutable)) {
    throw new Error(`RELEASE025 Missing ${target.id} Node executable: ${nodeExecutable}`);
  }

  assertStudioOnlyProduct(productRoot);
  assertNoForbiddenFiles(productRoot);
  assertTargetNativeDependencies(productRoot, target);
  console.log(`Structurally verified Renku ${release.version} ${release.target}.`);
  return { release, target, nodeExecutable };
}

function run(executable, args, homeDir) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    env: { ...process.env, ...(homeDir ? { HOME: homeDir, USERPROFILE: homeDir } : {}) },
  });
  if (result.status !== 0) {
    throw new Error(`RELEASE020 Smoke command failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

export function assertAboutOutput(output, version) {
  let about;
  try {
    about = JSON.parse(output);
  } catch {
    throw new Error('RELEASE020 Renku about did not return valid JSON.');
  }
  if (about.binary !== 'renku' || about.version !== version) {
    throw new Error(
      `RELEASE020 Renku about reported an unexpected product identity: ${output.trim()}`
    );
  }
}

async function verifyStudio(executable, cliEntry, homeDir) {
  const child = spawn(executable, [cliEntry, 'studio', 'start', '--no-browser'], {
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch('http://localhost:5173/studio-api/health');
        if (response.ok) {
          return;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('RELEASE022 Studio did not become healthy at http://localhost:5173.');
  } finally {
    child.kill('SIGTERM');
  }
}

function assertTargetNativeDependencies(productRoot, target) {
  const appRoot = path.join(productRoot, 'app');
  const coreRoot = realpathSync(
    path.join(appRoot, 'node_modules', '@gorenku', 'studio-core')
  );
  const requireFromCore = createRequire(path.join(coreRoot, 'package.json'));
  const betterSqlitePackage = resolvePackageManifest(
    requireFromCore,
    'better-sqlite3'
  );
  const betterSqliteRoot = path.dirname(betterSqlitePackage);
  const betterSqliteManifest = JSON.parse(readFileSync(betterSqlitePackage, 'utf8'));
  if (!betterSqliteManifest.version?.startsWith('13.')) {
    throw new Error(
      `RELEASE026 Product requires better-sqlite3 13; received ${betterSqliteManifest.version ?? 'unknown'}.`
    );
  }
  if (betterSqliteManifest.dependencies?.['prebuild-install']) {
    throw new Error('RELEASE026 better-sqlite3 still depends on prebuild-install.');
  }
  const sqlitePrebuild = path.join(
    betterSqliteRoot,
    'prebuilds',
    `${target.id}.node`
  );
  if (!existsSync(sqlitePrebuild)) {
    throw new Error(`RELEASE026 Missing better-sqlite3 prebuild: ${sqlitePrebuild}`);
  }

  const drizzleKitPackage = resolvePackageManifest(requireFromCore, 'drizzle-kit');
  const requireFromDrizzleKit = createRequire(drizzleKitPackage);
  const esbuildPackage = resolvePackageManifest(requireFromDrizzleKit, 'esbuild');
  const requireFromEsbuild = createRequire(esbuildPackage);
  try {
    requireFromEsbuild.resolve(`@esbuild/${target.id}/package.json`);
  } catch (error) {
    throw new Error(
      `RELEASE026 Missing esbuild package for ${target.id}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function resolvePackageManifest(requireFromOwner, packageName) {
  let current = path.dirname(requireFromOwner.resolve(packageName));
  while (current !== path.dirname(current)) {
    const manifestPath = path.join(current, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.name === packageName) {
        return manifestPath;
      }
    }
    current = path.dirname(current);
  }
  throw new Error(`RELEASE026 Could not resolve package manifest for ${packageName}.`);
}

function verificationReport(release, level) {
  return {
    product: 'renku',
    version: release.version,
    target: release.target,
    level,
    verifier: `${process.platform}-${process.arch}`,
    verifiedAt: new Date().toISOString(),
  };
}

export function writeVerificationReport(filePath, report) {
  writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
}

function assertNoForbiddenFiles(root) {
  const forbidden = ['.git', '.env', 'urban-basilica', 'sample-project'];
  const visit = (folder) => {
    for (const name of readdirSync(folder)) {
      const lower = name.toLowerCase();
      if (forbidden.some((value) => lower === value || lower.startsWith(`${value}.`))) {
        throw new Error(`RELEASE023 Forbidden release input: ${path.join(folder, name)}`);
      }
      const absolute = path.join(folder, name);
      if (statSync(absolute).isDirectory()) {
        visit(absolute);
      } else if (isScannableFile(absolute)) {
        const contents = readFileSync(absolute, 'utf8').toLowerCase();
        if (contents.includes('urban-basilica') || contents.includes('/users/keremk')) {
          throw new Error(`RELEASE023 Forbidden release content: ${absolute}`);
        }
      }
    }
  };
  visit(root);
}

export function assertStudioOnlyProduct(root) {
  const forbiddenProductRoots = ['plugin', '.agents', '.codex-plugin', '.claude-plugin', 'skills'];
  const found = forbiddenProductRoots.filter((name) => existsSync(path.join(root, name)));
  if (found.length > 0) {
    throw new Error(`RELEASE024 Studio product contains plugin-owned paths: ${found.join(', ')}`);
  }
}

function isScannableFile(file) {
  return statSync(file).size <= 5_000_000 &&
    ['.js', '.json', '.md', '.txt', '.toml', '.yaml', '.yml'].includes(path.extname(file));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const productRoot = path.resolve(args[0] ?? '');
  const modeIndex = args.indexOf('--mode');
  const mode = modeIndex >= 0 ? args[modeIndex + 1] : 'runtime';
  const reportIndex = args.indexOf('--report');
  const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : undefined;
  let report;
  if (mode === 'runtime') {
    report = await verifyProduct(productRoot);
  } else if (mode === 'structural') {
    const { release } = verifyProductStructure(productRoot);
    report = verificationReport(release, 'structural');
  } else {
    throw new Error(`RELEASE025 Unsupported verification mode: ${mode}.`);
  }
  if (reportPath) {
    writeVerificationReport(path.resolve(reportPath), report);
  }
}
