import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandOutput, readStudioVersion } from './release-contract.mjs';
import {
  BUNDLED_NODE_VERSION,
  SUPPORTED_NODE_RANGE,
  requireReleaseTarget,
  targetNodeExecutable,
} from './release-targets.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const options = readOptions(process.argv.slice(2));
const target = requireReleaseTarget(options.target);
const version = readStudioVersion(repositoryRoot);
const outputRoot = path.resolve(options.output ?? path.join(repositoryRoot, 'release', 'staging'));
assertReleaseOutput(outputRoot);
const productRoot = path.join(outputRoot, `renku-${version}-${target.id}`, 'renku');

rmSync(path.dirname(productRoot), { recursive: true, force: true });
mkdirSync(productRoot, { recursive: true });

execFileSync(
  'pnpm',
  ['--filter', '@gorenku/studio-cli', 'deploy', '--prod', '--legacy', path.join(productRoot, 'app')],
  { cwd: repositoryRoot, stdio: 'inherit' }
);
rmSync(path.join(productRoot, 'app', 'node_modules', '.modules.yaml'), {
  force: true,
});

if (!options.bundledNodeDir || !existsSync(options.bundledNodeDir)) {
  throw new Error(
    'RELEASE003 Product assembly requires --bundled-node-dir with an extracted official Node 24 runtime.'
  );
}
const runtimeRoot = path.join(productRoot, 'runtime', 'node');
cpSync(path.resolve(options.bundledNodeDir), runtimeRoot, {
  recursive: true,
  dereference: true,
});
if (!existsSync(targetNodeExecutable(runtimeRoot, target))) {
  throw new Error(`RELEASE003 Bundled Node runtime does not match ${target.id}.`);
}

cpSync(path.join(repositoryRoot, 'LICENSE'), path.join(productRoot, 'LICENSE'));
writeFileSync(
  path.join(productRoot, 'RELEASE.json'),
  `${JSON.stringify(
    {
      product: 'renku',
      version,
      target: target.id,
      supportedNode: SUPPORTED_NODE_RANGE,
      runtime: {
        kind: 'bundled-node',
        nodeVersion: BUNDLED_NODE_VERSION,
      },
      commit:
        process.env.GITHUB_SHA ??
        commandOutput('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot }),
      builtAt: new Date().toISOString(),
    },
    null,
    2
  )}\n`
);

assertRequiredRuntime(productRoot);
console.log(productRoot);

function assertRequiredRuntime(root) {
  const appRoot = path.join(root, 'app');
  const cliRoot = appRoot;
  const cliDependencyRoot = path.join(cliRoot, 'node_modules');
  const coreRoot = realpathSync(
    path.join(cliDependencyRoot, '@gorenku', 'studio-core')
  );
  const studioRoot = realpathSync(
    path.join(cliDependencyRoot, '@gorenku', 'studio')
  );
  const required = [
    'app/dist/cli.js',
    path.relative(root, path.join(coreRoot, 'drizzle', 'meta', '_journal.json')),
    path.relative(root, path.join(studioRoot, 'server-dist', 'index.js')),
    path.relative(root, path.join(studioRoot, 'dist', 'index.html')),
  ];
  const missing = required.filter((relativePath) => !existsSync(path.join(root, relativePath)));
  if (missing.length > 0) {
    throw new Error(`RELEASE004 Incomplete product tree:\n${missing.join('\n')}`);
  }
}

function assertReleaseOutput(output) {
  const allowedRoot = path.join(repositoryRoot, 'release');
  const relative = path.relative(allowedRoot, output);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`RELEASE005 Output must be inside ${allowedRoot}.`);
  }
}

function readOptions(args) {
  const result = {};
  const supported = new Set(['--target', '--output', '--bundled-node-dir']);
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (!name?.startsWith('--')) {
      throw new Error(`RELEASE006 Unexpected argument: ${name}`);
    }
    if (!supported.has(name)) {
      throw new Error(`RELEASE006 Unsupported option: ${name}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`RELEASE006 Missing value for ${name}`);
    }
    result[name.slice(2).replaceAll('-', '')] = value;
    index += 1;
  }
  const normalized = {
    target: result.target,
    output: result.output,
    bundledNodeDir: result.bundlednodedir,
  };
  if (!normalized.target) {
    throw new Error(
      'Usage: assemble-product.mjs --target <target> --bundled-node-dir <path>'
    );
  }
  return normalized;
}
