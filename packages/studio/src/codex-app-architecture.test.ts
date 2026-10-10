import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

it('isolates the Codex HTML entries from server packages and router frameworks', async () => {
  const workspace = path.dirname(sourceRoot);
  const entries = (await fs.readdir(path.join(workspace, 'codex-apps'))).filter((entry) => entry.endsWith('.html')).map((entry) => path.join('codex-apps', entry));
  expect(entries.length).toBeGreaterThan(0);
  const queue: string[] = [];
  for (const entry of entries) {
    const html = await fs.readFile(path.join(workspace, entry), 'utf8');
    const script = html.match(/<script[^>]+src="([^"]+)"/);
    expect(script).toBeTruthy();
    queue.push(path.join(workspace, script![1]!));
  }
  const inspected = new Set<string>();
  const forbidden = ['@gorenku/studio-core/server', '@gorenku/studio-codex', 'hono', '@hono/node-server', 'react-router', 'react-router-dom'];
  while (queue.length) {
    const file = queue.shift()!;
    if (inspected.has(file)) continue;
    inspected.add(file);
    const source = ts.createSourceFile(file, await fs.readFile(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) continue;
      const specifier = statement.moduleSpecifier.text;
      expect(specifier.startsWith('node:'), `${file} imports ${specifier}`).toBe(false);
      expect(forbidden.some((name) => specifier === name || (name !== '@gorenku/studio-codex' && specifier.startsWith(`${name}/`))), `${file} imports ${specifier}`).toBe(false);
      const target = await resolveLocalImport(file, specifier);
      if (target) {
        expect(path.relative(sourceRoot, target).startsWith('..'), `${file} imports outside the browser source layer`).toBe(false);
        queue.push(target);
      }
    }
  }
});

async function resolveLocalImport(file: string, specifier: string): Promise<string | undefined> {
  const base = specifier.startsWith('@/') ? path.join(sourceRoot, specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : undefined;
  if (!base || base.endsWith('.css')) return;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    try { if ((await fs.stat(candidate)).isFile()) return candidate; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  throw new Error(`Unresolved browser source import: ${specifier}.`);
}
