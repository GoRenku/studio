import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('generic generation architecture boundaries', () => {
  it('keeps provider validation independent from context, guides, and dependency planning', async () => {
    const source = await readFile(
      join(dirname(fileURLToPath(import.meta.url)), 'validation.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/from ['"].*\/context\.js['"]/);
    expect(source).not.toMatch(/from ['"].*\/dependencies\//);
    expect(source).not.toMatch(/from ['"].*reference-guide/);
  });
});
