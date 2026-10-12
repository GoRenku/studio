import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

it('keeps provider execution and Studio React outside the Codex server package', async () => {
  const files = await fs.readdir(sourceRoot, { recursive: true });
  const forbiddenPackages = ['@gorenku/studio-engines', '@gorenku/studio-cli', '@gorenku/studio'];
  for (const file of files.filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))) {
    const source = ts.createSourceFile(file, await fs.readFile(path.join(sourceRoot, file), 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if ((!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      expect(forbiddenPackages.some((name) => specifier === name || specifier.startsWith(`${name}/`)), `${file} imports ${specifier}`).toBe(false);
      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(path.join(sourceRoot, file)), specifier);
        const outside = path.relative(path.resolve(sourceRoot, '..'), target);
        expect(outside.startsWith('..'), `${file} imports a private workspace module`).toBe(false);
      }
    }
  }
});

it('keeps every exported contract file type-only and browser-safe', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(sourceRoot, '..', 'package.json'), 'utf8')) as { exports: Record<string, { import: string }> };
  const contractFiles = Object.entries(manifest.exports)
    .filter(([subpath]) => subpath !== '.')
    .map(([, target]) => target.import.replace(/^\.\/dist\//, '').replace(/\.js$/, '.ts'));
  expect(contractFiles.length).toBeGreaterThan(0);
  for (const file of contractFiles) {
    const source = ts.createSourceFile(file, await fs.readFile(path.join(sourceRoot, file), 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        expect(statement.importClause?.isTypeOnly, `${file} imports ${statement.moduleSpecifier.text} at runtime`).toBe(true);
        expect(statement.moduleSpecifier.text.startsWith('node:'), `${file} imports ${statement.moduleSpecifier.text}`).toBe(false);
        expect(statement.moduleSpecifier.text.startsWith('@gorenku/studio-core/server'), `${file} imports ${statement.moduleSpecifier.text}`).toBe(false);
      }
      const runtime = ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement);
      expect(runtime, `${file} declares runtime code`).toBe(false);
    }
  }
});
