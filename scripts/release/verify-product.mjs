import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const productRoot = path.resolve(process.argv[2] ?? '');
if (!existsSync(path.join(productRoot, 'RELEASE.json'))) {
  throw new Error('Usage: verify-product.mjs <renku-product-root>');
}
const release = JSON.parse(readFileSync(path.join(productRoot, 'RELEASE.json'), 'utf8'));
const nodeExecutable = resolveNodeExecutable(productRoot, release.nodeFlavor);
const cliEntry = path.join(productRoot, 'app', 'dist', 'cli.js');
const testHome = mkdtempSync(path.join(os.tmpdir(), 'renku-release-verify-'));

assertNoForbiddenFiles(productRoot);
run(nodeExecutable, [cliEntry, 'about']);
run(nodeExecutable, [cliEntry, 'init', path.join(testHome, 'movies'), '--json'], testHome);
run(nodeExecutable, [cliEntry, 'create', 'release-smoke', '--title', 'Release Smoke', '--json'], testHome);
await verifyStudio(nodeExecutable, cliEntry, testHome);
console.log(`Verified Renku ${release.version} ${release.target} ${release.nodeFlavor}`);

function run(executable, args, homeDir) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    env: { ...process.env, ...(homeDir ? { HOME: homeDir, USERPROFILE: homeDir } : {}) },
  });
  if (result.status !== 0) {
    throw new Error(`RELEASE020 Smoke command failed:\n${result.stdout}\n${result.stderr}`);
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

function resolveNodeExecutable(root, flavor) {
  if (flavor !== 'bundled-node24') {
    return process.execPath;
  }
  return process.platform === 'win32'
    ? path.join(root, 'runtime', 'node', 'node.exe')
    : path.join(root, 'runtime', 'node', 'bin', 'node');
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

function isScannableFile(file) {
  return statSync(file).size <= 5_000_000 &&
    ['.js', '.json', '.md', '.txt', '.toml', '.yaml', '.yml'].includes(path.extname(file));
}
