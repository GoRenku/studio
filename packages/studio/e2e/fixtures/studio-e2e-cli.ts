import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { StudioE2eRuntime } from './studio-e2e-runtime';

const execFileAsync = promisify(execFile);

export async function runStudioE2eMediaImport(input: {
  runtime: StudioE2eRuntime;
  projectName: string;
  purpose: string;
  target: string;
  source: string;
  title: string;
}): Promise<void> {
  const cliPath = path.join(
    input.runtime.workspaceRoot,
    'packages',
    'cli',
    'dist',
    'cli.js'
  );
  await execFileAsync(
    process.execPath,
    [
      cliPath,
      'media',
      'import',
      '--json',
      '--project',
      input.projectName,
      '--purpose',
      input.purpose,
      '--target',
      input.target,
      '--source',
      input.source,
      '--title',
      input.title,
    ],
    {
      cwd: input.runtime.workspaceRoot,
      env: { ...process.env, HOME: input.runtime.homeDir },
    }
  );
}
