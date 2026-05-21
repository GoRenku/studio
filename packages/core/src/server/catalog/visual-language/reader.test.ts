import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  readVisualLanguageCatalog,
  readVisualLanguageCatalogEntry,
} from './reader.js';

describe('visual language catalog reader', () => {
  it('reads frontmatter, prompt template, and illustration metadata', async () => {
    const catalogRoot = await writeCatalogEntry({
      id: 'camera.locked-off-tripod',
      category: 'camera',
      entrySlug: 'locked-off-tripod',
    });

    const catalog = await readVisualLanguageCatalog({ catalogRoot });

    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0]).toMatchObject({
      id: 'camera.locked-off-tripod',
      category: 'camera',
      name: 'Locked-off tripod',
      summary: 'Stable, restrained camera.',
      explanationMarkdown: '# Explanation\n\nA stable camera position.',
      promptTemplateMarkdown: '# Prompt\n\nLocked-off tripod shot.',
      illustration: {
        catalogRelativePath: 'camera/locked-off-tripod/illustration.svg',
        mediaKind: 'image',
      },
      tags: ['camera'],
      appliesTo: ['scene.video'],
      difficulty: 'beginner',
    });

    await expect(
      readVisualLanguageCatalogEntry({
        catalogRoot,
        id: 'camera.locked-off-tripod',
      })
    ).resolves.toMatchObject({ name: 'Locked-off tripod' });
  });

  it('fails when a prompt template is missing', async () => {
    const catalogRoot = await writeCatalogEntry({
      id: 'lighting.practical-candlelight',
      category: 'lighting',
      entrySlug: 'practical-candlelight',
      skipPromptTemplate: true,
    });

    await expect(readVisualLanguageCatalog({ catalogRoot })).rejects.toMatchObject({
      code: 'VISUAL_LANGUAGE_CATALOG999',
    });
  });
});

async function writeCatalogEntry(input: {
  id: string;
  category: string;
  entrySlug: string;
  skipPromptTemplate?: boolean;
}): Promise<string> {
  const catalogRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-catalog-'));
  const entryDir = path.join(catalogRoot, input.category, input.entrySlug);
  await fs.mkdir(entryDir, { recursive: true });
  await fs.writeFile(
    path.join(entryDir, 'explanation.md'),
    `---
id: ${input.id}
category: ${input.category}
name: Locked-off tripod
summary: Stable, restrained camera.
promptTemplate: prompt-template.md
illustration:
  file: illustration.svg
  mediaKind: image
tags:
  - camera
appliesTo:
  - scene.video
difficulty: beginner
---
# Explanation

A stable camera position.
`,
    'utf8'
  );
  if (!input.skipPromptTemplate) {
    await fs.writeFile(
      path.join(entryDir, 'prompt-template.md'),
      '# Prompt\n\nLocked-off tripod shot.\n',
      'utf8'
    );
  }
  await fs.writeFile(
    path.join(entryDir, 'illustration.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'utf8'
  );
  return catalogRoot;
}
