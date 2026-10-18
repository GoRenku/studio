import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

// These files run straight from the working copy, without
// pnpm install or a build, so they may use only Node built-ins and siblings.
test('growth dashboard scripts import only Node built-ins and sibling files', () => {
  const folder = new URL('./', import.meta.url);
  const scripts = readdirSync(folder).filter((name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs'));
  assert.ok(scripts.length > 0);
  for (const name of scripts) {
    const source = readFileSync(new URL(name, folder), 'utf8');
    const specifiers = [...source.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
    for (const specifier of specifiers) {
      assert.ok(specifier.startsWith('node:') || /^\.\/[^/]+\.mjs$/.test(specifier), `${name} imports ${specifier}`);
    }
  }
});
