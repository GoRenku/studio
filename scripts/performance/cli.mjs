import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export function summarize(samples) {
  const sorted = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  return { medianMs: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}

export async function benchmark(argv) {
  const { values } = parseArgs({ args: argv, options: {
    project: { type: 'string' }, iterations: { type: 'string', default: '10' },
    output: { type: 'string' }, 'product-root': { type: 'string' },
  }});
  const iterations = Number(values.iterations);
  if (!values.project || !values.output || !Number.isInteger(iterations) || iterations < 10) {
    throw new Error('Provide --project, --output, and --iterations of at least 10.');
  }
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const product = values['product-root'];
  const cli = product ? path.join(product, 'app/dist/cli.js') : path.join(root, 'packages/cli/dist/cli.js');
  const executable = product ? path.join(product, 'runtime/node', process.platform === 'win32' ? 'node.exe' : 'bin/node') : process.execPath;
  if (!existsSync(cli) || !existsSync(executable)) throw new Error('Build/assemble the CLI before benchmarking.');
  const core = path.resolve(path.dirname(cli), '../node_modules/@gorenku/studio-core');
  const requireCore = createRequire(path.join(core, 'package.json'));
  const { resolveRenkuStorageRoot } = await import(pathToFileURL(path.join(core, 'dist/server/config/index.js')));
  const { resolveCurrentProjectStoreSchemaGeneration } = await import(pathToFileURL(path.join(core, 'dist/server/database/lifecycle/project-store-schema-generation-reader.js')));
  const storageRoot = await resolveRenkuStorageRoot();
  if (path.basename(values.project) !== values.project) throw new Error('Use an exact project name.');
  const Database = requireCore('better-sqlite3');
  const db = new Database(path.join(storageRoot, values.project, '.renku/project.sqlite'), { readonly: true, fileMustExist: true });
  try {
    if (db.pragma('user_version', { simple: true }) !== resolveCurrentProjectStoreSchemaGeneration() || !db.prepare('select 1 from __drizzle_migrations limit 1').get()) {
      throw new Error('Project schema is not current; benchmark will not migrate it.');
    }
  } finally { db.close(); }
  const scenarios = [
    ['empty-node', null], ['help', ['--help']], ['version', ['--version']],
    ['current', ['project', 'current', '--json']],
    ['information', ['info', 'show', '--project', values.project, '--json']],
    ['inspiration', ['inspiration', 'list', '--project', values.project, '--json']],
  ];
  const report = { revision: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
    version: JSON.parse(readFileSync(path.join(path.dirname(cli), '../package.json'))).version,
    node: spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim(),
    platform: process.platform, architecture: process.arch, executable, cli, iterations,
    note: 'Fresh processes; warm filesystem cache. Timings overlap and must not be summed.', scenarios: {} };
  for (const [name, args] of scenarios) {
    const run = () => {
      const start = performance.now();
      const result = spawnSync(executable, args ? [cli, ...args] : ['-e', ''], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      const sample = { durationMs: performance.now() - start, stdoutBytes: Buffer.byteLength(result.stdout ?? ''), stderrBytes: Buffer.byteLength(result.stderr ?? ''), exitStatus: result.status };
      if (result.error || result.status !== 0) throw new Error(`Scenario ${name} failed: ${result.error ?? result.stderr}`);
      return sample;
    };
    const first = run();
    const samples = Array.from({ length: iterations }, run);
    report.scenarios[name] = { first, ...summarize(samples), samples };
    if (args) {
      const observer = new URL('./observe.mjs', import.meta.url);
      const observationPath = `${values.output}.${name}.imports.json`;
      observer.searchParams.set('output', observationPath);
      const observed = spawnSync(executable, ['--import', observer.href, cli, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      if (observed.status !== 0) throw new Error(`Import probe ${name} failed: ${observed.stderr}`);
      report.scenarios[name].instrumented = JSON.parse(readFileSync(observationPath, 'utf8'));
    }
  }
  writeFileSync(values.output, JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  benchmark(process.argv.slice(2)).then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
