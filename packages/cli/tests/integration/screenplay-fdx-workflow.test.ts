import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '@gorenku/studio-core/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { runRenkuCli } from '../../src/cli.js';

describe('screenplay FDX CLI workflow', () => {
  let homeDir: string;
  let sourcePath: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-fdx-workflow-'));
    const storageRoot = path.join(homeDir, 'projects');
    const configDir = path.join(homeDir, '.config', 'renku');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, 'config.yaml'),
      `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
      'utf8',
    );
    await createProjectDataService().createMovieProject({
      projectName: 'cli-fdx',
      title: 'CLI FDX',
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
    });
    sourcePath = path.join(homeDir, 'screenplay.fdx');
    stdout = [];
    stderr = [];
  });

  it('runs imported, unchanged, and automatic refreshed states with flat read-back', async () => {
    await fs.writeFile(sourcePath, fdx([
      ['New Act', 'ACT ONE'],
      ['Outline 2', 'CUSTOM CONFLICT'],
      ['Scene Heading', 'INT. FIRST ROOM - DAY'],
      ['Action', 'First action.'],
      ['Scene Heading', 'INT. SECOND ROOM - DAY'],
      ['Action', 'Second action.'],
    ]), 'utf8');

    const imported = await importFdx();
    expect(imported.status).toBe('imported');
    expect(imported.counts).toEqual({
      scenes: 2,
      blocks: 2,
      dialogueTurns: 0,
      productionSceneNumbers: 0,
    });
    expect(imported).not.toHaveProperty('operation');
    expect(imported).not.toHaveProperty('changes');
    expect(imported).not.toHaveProperty('approvalToken');

    const unchanged = await importFdx();
    expect(unchanged).toMatchObject({ status: 'unchanged', resourceKeys: [] });

    await fs.writeFile(sourcePath, fdx([
      ['New Act', 'ACT TWO'],
      ['Scene Heading', 'INT. SECOND ROOM - DAY'],
      ['Action', 'Second action changed.'],
    ]), 'utf8');
    const refreshed = await importFdx();
    expect(refreshed.status).toBe('refreshed');
    expect(refreshed.resourceKeys.length).toBeGreaterThan(0);

    stdout = [];
    stderr = [];
    const exitCode = await runRenkuCli(
      ['screenplay', 'structure', '--project', 'cli-fdx', '--json'],
      { homeDir, io: captureIo(stdout, stderr) },
    );
    expect(exitCode, stderr.join('\n')).toBe(0);
    const structure = JSON.parse(stdout.join('\n')) as {
      screenplay: {
        sections: unknown[];
        scenes: Array<{ heading: string; blocks: Array<{ text?: string }> }>;
        structure: Array<{ parentSectionId?: string; content: { type: string }; position: number }>;
      };
    };
    expect(structure.screenplay.sections).toEqual([]);
    expect(structure.screenplay.scenes).toMatchObject([{
      heading: 'INT. SECOND ROOM - DAY',
      blocks: [{ text: 'Second action changed.' }],
    }]);
    expect(structure.screenplay.structure).toEqual([{
      id: expect.any(String),
      content: { type: 'scene', sceneId: expect.any(String) },
      position: 0,
    }]);
  });

  async function importFdx(): Promise<{
    status: string;
    counts: Record<string, number>;
    resourceKeys: string[];
    [key: string]: unknown;
  }> {
    stdout = [];
    stderr = [];
    const exitCode = await runRenkuCli(
      [
        'screenplay',
        'import-fdx',
        '--project',
        'cli-fdx',
        '--file',
        sourcePath,
        '--json',
      ],
      { homeDir, io: captureIo(stdout, stderr) },
    );
    expect(exitCode, stderr.join('\n')).toBe(0);
    return JSON.parse(stdout.join('\n')) as {
      status: string;
      counts: Record<string, number>;
      resourceKeys: string[];
      [key: string]: unknown;
    };
  }
});

function fdx(paragraphs: Array<[string, string]>): string {
  return '<FinalDraft DocumentType="Script"><Content>'
    + paragraphs.map(([type, text]) =>
      `<Paragraph Type="${type}"><Text>${text}</Text></Paragraph>`
    ).join('')
    + '</Content></FinalDraft>';
}

function captureIo(stdout: string[], stderr: string[]) {
  return {
    stdout: { log: (message: string) => stdout.push(message) },
    stderr: { error: (message: string) => stderr.push(message) },
  };
}
