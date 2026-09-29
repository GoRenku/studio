import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cliPath = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));

describe('CLI output pipes', () => {
  it('finishes successfully when the consumer reads the response', async () => {
    const child = spawn(process.execPath, [cliPath, '--help'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    expect(code).toBe(0);
    expect(stdout).toContain('$ renku <command>');
    expect(stderr).toBe('');
  });

  it.each([false, true])('reports a closed consumer without an unhandled stack (json: %s)', async (json) => {
    const child = spawn(process.execPath, [cliPath, '--help', ...(json ? ['--json'] : [])], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.destroy();
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    expect(code).toBe(1);
    expect(stderr).toContain('CLI_OUTPUT_CLOSED');
    expect(stderr).not.toContain('Unhandled');
    expect(stderr).not.toContain('node:events');
    if (json) {
      expect(JSON.parse(stderr).error.code).toBe('CLI_OUTPUT_CLOSED');
    }
  });
});
