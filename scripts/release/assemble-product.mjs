import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPPORTED_NODE_RANGE,
  requireNodeFlavor,
  requireReleaseTarget,
} from './release-targets.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const options = readOptions(process.argv.slice(2));
const target = requireReleaseTarget(options.target);
const nodeFlavor = requireNodeFlavor(options.flavor);
const outputRoot = path.resolve(options.output ?? path.join(repositoryRoot, 'release', 'staging'));
assertReleaseOutput(outputRoot);
const productRoot = path.join(outputRoot, `renku-${options.version}-${target.id}-${nodeFlavor}`, 'renku');

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

if (nodeFlavor === 'bundled-node24') {
  if (!options.bundledNodeDir || !existsSync(options.bundledNodeDir)) {
    throw new Error('RELEASE003 bundled-node24 requires --bundled-node-dir with an extracted official Node 24 runtime.');
  }
  cpSync(path.resolve(options.bundledNodeDir), path.join(productRoot, 'runtime', 'node'), {
    recursive: true,
    dereference: true,
  });
}

cpSync(path.join(repositoryRoot, 'LICENSE'), path.join(productRoot, 'LICENSE'));
copyAgentPlugin(productRoot, options.skillsDir);
setAgentPluginVersion(productRoot, options.version);
const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
writeFileSync(
  path.join(productRoot, 'RELEASE.json'),
  `${JSON.stringify(
    {
      product: 'renku',
      version: options.version,
      target: target.id,
      nodeFlavor,
      supportedNode: SUPPORTED_NODE_RANGE,
      commit: options.commit ?? process.env.GITHUB_SHA ?? 'local',
      builtAt: new Date().toISOString(),
      workspaceVersion: packageJson.version,
    },
    null,
    2
  )}\n`
);

assertRequiredRuntime(productRoot);
assertAgentPluginVersion(productRoot, options.version);
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
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (!name?.startsWith('--')) {
      throw new Error(`RELEASE006 Unexpected argument: ${name}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`RELEASE006 Missing value for ${name}`);
    }
    result[name.slice(2).replaceAll('-', '')] = value;
    index += 1;
  }
  const normalized = {
    version: result.version,
    target: result.target,
    flavor: result.flavor,
    output: result.output,
    commit: result.commit,
    bundledNodeDir: result.bundlednodedir,
    skillsDir: result.skillsdir,
  };
  if (!normalized.version || !normalized.target || !normalized.flavor) {
    throw new Error('Usage: assemble-product.mjs --version <version> --target <target> --flavor <flavor> [--bundled-node-dir <path>]');
  }
  return normalized;
}

function copyAgentPlugin(root, configuredSkillsDir) {
  const skillsRoot = path.resolve(
    configuredSkillsDir ??
      process.env.RENKU_SKILLS_DIR ??
      path.join(repositoryRoot, '..', 'studio-skills')
  );
  const manifest = path.join(skillsRoot, '.codex-plugin', 'plugin.json');
  if (!existsSync(manifest)) {
    throw new Error(`RELEASE007 Renku agent plugin was not found at ${skillsRoot}. Pass --skills-dir.`);
  }
  const destination = path.join(root, 'plugin');
  for (const relativePath of [
    '.agents',
    '.claude-plugin',
    '.codex-plugin',
    'docs',
    'skills',
    'LICENSE',
    'README.md',
  ]) {
    const source = path.join(skillsRoot, relativePath);
    if (existsSync(source)) {
      cpSync(source, path.join(destination, relativePath), {
        recursive: true,
        dereference: true,
        filter: (candidate) => {
          const relativeCandidate = path
            .relative(skillsRoot, candidate)
            .toLowerCase();
          return !relativeCandidate.includes('urban-basilica') &&
            !relativeCandidate.includes('urban_basilica');
        },
      });
    }
  }
}

function setAgentPluginVersion(root, version) {
  for (const relativePath of [
    'plugin/.codex-plugin/plugin.json',
    'plugin/.claude-plugin/plugin.json',
  ]) {
    const manifestPath = path.join(root, relativePath);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.version = version;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

function assertAgentPluginVersion(root, version) {
  for (const relativePath of [
    'plugin/.codex-plugin/plugin.json',
    'plugin/.claude-plugin/plugin.json',
  ]) {
    const manifestPath = path.join(root, relativePath);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.version !== version) {
      throw new Error(`RELEASE008 Plugin version mismatch in ${manifestPath}.`);
    }
  }
}
