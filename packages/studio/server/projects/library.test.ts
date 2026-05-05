import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { listMovieProjects } from './library.js';

const testHome = vi.hoisted(() => ({
  value: '',
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    default: {
      ...actual,
      homedir: () => testHome.value,
    },
    homedir: () => testHome.value,
  };
});

describe('movie project library config', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-studio-home-'));
    testHome.value = homeDir;
  });

  it('uses storageRoot from the global Renku config', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    await writeConfig(homeDir, storageRoot);
    await writeMovieProject(path.join(storageRoot, 'constantinople'));

    const library = await listMovieProjects();

    expect(library.storageRoot).toBe(storageRoot);
    expect(library.movies).toHaveLength(1);
    expect(library.movies[0]).toMatchObject({
      folderName: 'constantinople',
      title: 'Preparation of the Siege',
    });
  });

  it('fails clearly when global Renku config is missing', async () => {
    await expect(listMovieProjects()).rejects.toMatchObject({
      code: 'C002',
    });
  });
});

async function writeConfig(homeDir: string, storageRoot: string): Promise<void> {
  const configDir = path.join(homeDir, '.config', 'renku');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
    'utf8'
  );
}

async function writeMovieProject(projectFolder: string): Promise<void> {
  await fs.mkdir(projectFolder, { recursive: true });
  await fs.writeFile(path.join(projectFolder, 'narrative.md'), '# Narrative');
  await fs.writeFile(
    path.join(projectFolder, 'movie.yaml'),
    `kind: renku.movie
version: 0.1.0

movie:
  id: movie_constantinople_preparation
  title: Preparation of the Siege
  narrativeFile: narrative.md

cast:
  - id: cast_narrator
    name: Narrator

sequences:
  - id: seq_opening
    title: Opening
    scenes:
      - id: scene_opening
        title: Opening Scene
        clips:
          - id: clip_opening
            title: Opening Image
`,
    'utf8'
  );
}
