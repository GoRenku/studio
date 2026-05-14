import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';

export async function runCreateOrSkip<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Could not locate the bindings file')
    ) {
      console.warn('Skipping project SQLite assertion because native bindings are not built.');
      return null;
    }
    throw error;
  }
}

export async function writeConfig(homeDir: string, storageRoot: string): Promise<void> {
  const configDir = path.join(homeDir, '.config', 'renku');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
    'utf8'
  );
}

export async function writeProjectSetup(
  homeDir: string,
  options: { extraProjectFields?: string } = {}
): Promise<string> {
  const setupPath = path.join(homeDir, 'project.yaml');
  await writeSetupMarkdownFixture(
    homeDir,
    'sample-project/visual-language/lighting/practical-source-low-key-interiors/guidance.md',
    'Formal staging and controlled historical detail.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'sample-project/visual-language/lighting/practical-source-low-key-interiors/prompt.md',
    'Warm practical candlelight, deep brown shadows.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'sample-project/continuity/locations/mehmeds-council-chamber/description.md',
    'Formal Ottoman planning room with maps and oil lamps.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'sample-project/cast/mehmed-ii/description.md',
    'Cast description from Markdown.'
  );
  await fs.writeFile(
    setupPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  name: constantinople
  title: Preparation of the Siege
  type: standaloneMovie
  logline: A documentary about preparation before 1453.
  summary: A documentary setup summary for Markdown storage.
${options.extraProjectFields ?? ''}

languages:
  - localeTag: en-US
    displayName: English
    isBase: true
    supportsAudio: true
    supportsSubtitles: true
  - localeTag: tr-TR
    displayName: Turkish
    supportsAudio: true
    supportsSubtitles: true

visualLanguageCategories:
  - name: Lighting
    description: Light behavior and source logic.
  - name: Camera
    description: Camera placement and motion.

visualLanguage:
  - category: Lighting
    name: Practical-source low-key interiors
    shortDescription: Warm practical interiors.
    priority: default
    guidanceFile: sample-project/visual-language/lighting/practical-source-low-key-interiors/guidance.md
    promptFile: sample-project/visual-language/lighting/practical-source-low-key-interiors/prompt.md

cast:
  - name: Narrator
    kind: narrator
    role: voiceover
  - name: Mehmed II
    kind: historical_figure
    role: protagonist
    descriptionFile: sample-project/cast/mehmed-ii/description.md

continuityReferences:
  - kind: location
    name: Mehmed's council chamber
    shortDescription: Formal Ottoman planning room.
    descriptionFile: sample-project/continuity/locations/mehmeds-council-chamber/description.md

sequences:
  - title: The Young Sultan's Obsession
    shortTitle: Ambition
    summary: Mehmed turns conquest into policy.
    scenes:
      - title: A Throne Facing an Ancient City
        summary: Mehmed's accession is framed against Constantinople.
        clips:
          - title: The New Sultan
            summary: Mehmed is introduced as controlled and ambitious.
            visualIntent: Quiet court staging.
          - title: The City In His Mind
            summary: Constantinople appears as an imperial problem.
`,
    'utf8'
  );
  return setupPath;
}

async function writeSetupMarkdownFixture(
  homeDir: string,
  relativePath: string,
  content: string
): Promise<void> {
  const filePath = path.join(homeDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function writeEpisodeProjectSetup(homeDir: string): Promise<string> {
  const setupPath = path.join(homeDir, 'episode-project.yaml');
  await fs.writeFile(
    setupPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  name: constantinople-series
  title: Preparation of the Siege
  type: series
  logline: A documentary series about preparation before 1453.

languages:
  - localeTag: en-US
    displayName: English
    isBase: true
    supportsAudio: true
    supportsSubtitles: true

episodes:
  - title: The First Preparations
    shortTitle: Preparations
    episodeNumber: 1
    summary: Mehmed turns an inherited ambition into a concrete plan.
    sequences:
      - title: The Young Sultan's Obsession
        shortTitle: Ambition
        scenes:
          - title: A Throne Facing an Ancient City
            clips:
              - title: The New Sultan
`,
    'utf8'
  );
  return setupPath;
}

export async function writeMinimalProjectSetup(homeDir: string): Promise<string> {
  const setupPath = path.join(homeDir, 'minimal-project.yaml');
  await fs.writeFile(
    setupPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
  name: blank-movie
  title: Blank Movie
  type: standaloneMovie
`,
    'utf8'
  );
  return setupPath;
}

export async function writeNarrativeProjectSetup(
  homeDir: string,
  options: {
    projectNameLine?: string;
    projectSummaryFile?: string;
  } = {}
): Promise<string> {
  const setupPath = path.join(homeDir, 'narrative-project.yaml');
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/project-summary.md',
    'Project summary from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/clips/new-sultan-summary.md',
    'Clip summary from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/clips/new-sultan-visual-intent.md',
    'Quiet court staging from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/visual-language/lighting-guidance.md',
    'Lighting guidance from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/visual-language/lighting-prompt.md',
    'Lighting prompt from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/continuity/mehmeds-council-chamber.md',
    'Continuity description from Markdown.'
  );
  await writeSetupMarkdownFixture(
    homeDir,
    'narrative/cast/mehmed-ii.md',
    'Cast description from Markdown.'
  );
  await writeSetupMarkdownFixture(homeDir, 'narrative/cover.png', 'narrative cover');
  await fs.writeFile(
    setupPath,
    `kind: renku.projectSetup
version: 0.1.0

project:
${options.projectNameLine ?? '  name: constantinople\n'}  title: Preparation of the Siege
  type: standaloneMovie
  aspectRatio: "16:9"
  coverFile: narrative/cover.png
  logline: A documentary about preparation before 1453.
  summaryFile: ${options.projectSummaryFile ?? 'narrative/project-summary.md'}

languages:
  - localeTag: en-US
    displayName: English
    isBase: true
    supportsAudio: true
    supportsSubtitles: true

cast:
  - name: Narrator
    kind: narrator
    role: Voiceover
  - name: Mehmed II
    kind: historical_figure
    role: Protagonist
    shortDescription: Young Ottoman sultan.
    descriptionFile: narrative/cast/mehmed-ii.md

visualLanguageCategories:
  - name: Lighting
    description: Light behavior and source logic.
  - name: Camera
    description: Camera placement and motion.

visualLanguage:
  - category: Lighting
    name: Practical-source low-key interiors
    shortDescription: Warm practical interiors.
    priority: default
    guidanceFile: narrative/visual-language/lighting-guidance.md
    promptFile: narrative/visual-language/lighting-prompt.md

continuityReferences:
  - kind: location
    name: Mehmed's council chamber
    shortDescription: Formal Ottoman planning room.
    descriptionFile: narrative/continuity/mehmeds-council-chamber.md

sequences:
  - title: The Young Sultan's Obsession
    shortTitle: Ambition
    summary: Mehmed turns conquest into policy.
    scenes:
      - title: A Throne Facing an Ancient City
        summary: Mehmed's accession is framed against Constantinople.
        clips:
          - title: The New Sultan
            summaryFile: narrative/clips/new-sultan-summary.md
            visualIntentFile: narrative/clips/new-sultan-visual-intent.md
`,
    'utf8'
  );
  return setupPath;
}

export function tableColumns(database: Database.Database, tableName: string): string[] {
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => (row as { name: string }).name);
}

export function readAssetFileMetadata(
  databasePath: string,
  assetId: string
): { contentHash: string | null; sizeBytes: number | null; updatedAt: string } {
  const database = new Database(databasePath, { readonly: true });
  try {
    const row = database
      .prepare(
        `select content_hash as contentHash, size_bytes as sizeBytes,
          updated_at as updatedAt
         from asset_file
         where asset_id = ?`
      )
      .get(assetId) as
      | { contentHash: string | null; sizeBytes: number | null; updatedAt: string }
      | undefined;
    if (!row) {
      throw new Error(`Asset file was not found for asset ${assetId}.`);
    }
    return row;
  } finally {
    database.close();
  }
}
