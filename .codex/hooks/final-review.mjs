#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const event = readStdinJson();

if (event.stop_hook_active === true) {
  emitContinue();
}

const repoRoot = git(['rev-parse', '--show-toplevel']);
const changedFiles = getChangedFiles();
const issues = [];

for (const filePath of changedFiles) {
  const absolutePath = path.join(repoRoot, filePath);
  if (!existsSync(absolutePath) || !isReviewableFile(filePath)) {
    continue;
  }

  const text = readFileSync(absolutePath, 'utf8');
  const lines = text.split(/\r?\n/);

  checkWorkspaceReExports(filePath, lines);
  checkCompatibilityCode(filePath, lines);
  checkObsoleteFormatTests(filePath, lines);
  checkYamlDrivenSchema(filePath, lines);
  checkStudioDataOwnership(filePath, lines);
}

if (issues.length === 0) {
  emitContinue();
}

emitBlock(buildContinuationPrompt(issues));

function readStdinJson() {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw.length === 0) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    emitBlock('The Renku Studio final review hook received invalid JSON on stdin. Fix the hook input before calling the work done.');
  }
}

function getChangedFiles() {
  const tracked = git(['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD'])
    .split('\n')
    .filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

function checkWorkspaceReExports(filePath, lines) {
  if (!filePath.startsWith('packages/') || !filePath.endsWith('/src/index.ts')) {
    return;
  }

  const packageName = packageNameForFile(filePath);
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['"](@gorenku\/studio-[^'"]+)['"]/);
    if (match && match[1] !== packageName) {
      addIssue({
        rule: 'No convenience re-exports',
        filePath,
        line: index + 1,
        message: `Do not re-export ${match[1]} from ${packageName}. Import from the owning package and fix callers directly.`,
      });
    }
  }
}

function checkCompatibilityCode(filePath, lines) {
  if (!isCodeOrTestFile(filePath)) {
    return;
  }

  if (filePath === '.codex/hooks/final-review.mjs' || isToolingConfigFile(filePath)) {
    return;
  }

  const patterns = [
    {
      pattern: /(?:legacy|compat(?:ibility)?|backward(?:s)?Compatible|backward(?:s)?Compatibility|shim|alias(?:es)?|fallback)/i,
      message: 'Pre-customer code must not add legacy, compatibility, shim, alias, or fallback branches.',
    },
    {
      pattern: /\b(?:old|previous|prior)\s+(?:format|schema|api|structure|name|behavior)\b/i,
      message: 'Do not branch code or tests around obsolete formats, schemas, APIs, structures, names, or behavior.',
    },
  ];

  for (const [index, line] of lines.entries()) {
    if (line.includes('final-review.mjs')) {
      continue;
    }
    for (const { pattern, message } of patterns) {
      if (pattern.test(line)) {
        addIssue({ rule: 'No compatibility code', filePath, line: index + 1, message });
      }
    }
  }
}

function checkObsoleteFormatTests(filePath, lines) {
  if (!isTestFile(filePath)) {
    return;
  }

  const pattern = /\b(?:rejects?|fails?|throws?|errors?)\b.*\b(?:old|obsolete|legacy|previous|prior)\b/i;
  for (const [index, line] of lines.entries()) {
    if (pattern.test(line)) {
      addIssue({
        rule: 'Current behavior tests only',
        filePath,
        line: index + 1,
        message: 'Tests should describe current intended behavior, not preserve a museum of obsolete formats.',
      });
    }
  }
}

function checkYamlDrivenSchema(filePath, lines) {
  if (!isSchemaOrMigrationFile(filePath)) {
    return;
  }

  const pattern = /\b(?:yaml|front.?matter|import file|setup file)\b/i;
  for (const [index, line] of lines.entries()) {
    if (pattern.test(line)) {
      addIssue({
        rule: 'Schema is not import-driven',
        filePath,
        line: index + 1,
        message: 'Database schema changes must be deliberate and must not be inferred from YAML import fields.',
      });
    }
  }
}

function checkStudioDataOwnership(filePath, lines) {
  if (!filePath.startsWith('packages/studio/server/')) {
    return;
  }

  const patterns = [
    {
      pattern: /\bfrom\s+['"]better-sqlite3['"]/,
      message: 'Studio server must not own SQLite driver access. Use core-owned data APIs.',
    },
    {
      pattern: /\bfrom\s+['"]drizzle-orm(?:\/[^'"]*)?['"]/,
      message: 'Studio server must not own Drizzle access. Use core-owned data APIs.',
    },
    {
      pattern: /\bfrom\s+['"][^'"]*(?:sqlite-project-store|project-reader|project-library-reader|project-records|cast-member-records|visual-language-records|project-language-records)['"]/,
      message: 'Studio server must call core command/query APIs, not core-internal data modules.',
    },
  ];

  for (const [index, line] of lines.entries()) {
    if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) {
      continue;
    }
    for (const { pattern, message } of patterns) {
      if (pattern.test(line)) {
        addIssue({ rule: 'Core-owned data access', filePath, line: index + 1, message });
      }
    }
  }
}

function isReviewableFile(filePath) {
  if (filePath.startsWith('.codex/hooks/')) {
    return filePath.endsWith('final-review.mjs');
  }
  if (filePath.startsWith('docs/') || filePath === 'AGENTS.md') {
    return false;
  }
  return isCodeOrTestFile(filePath) || isSchemaOrMigrationFile(filePath);
}

function isCodeOrTestFile(filePath) {
  return /\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(filePath);
}

function isToolingConfigFile(filePath) {
  return /(?:^|\/)(?:eslint|vitest|vite|drizzle|prettier|tsconfig)[^/]*\.(?:cjs|cts|js|mjs|mts|ts)$/.test(filePath);
}

function isTestFile(filePath) {
  return /\.(?:test|spec)\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(filePath);
}

function isSchemaOrMigrationFile(filePath) {
  return (
    filePath.startsWith('packages/core/drizzle/') ||
    /packages\/core\/src\/.*schema.*\.(?:ts|tsx)$/.test(filePath) ||
    /packages\/core\/src\/.*record.*\.(?:ts|tsx)$/.test(filePath)
  );
}

function packageNameForFile(filePath) {
  const packagePath = filePath.split('/').slice(0, 2).join('/');
  const packageJsonPath = path.join(repoRoot, packagePath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).name;
}

function addIssue(issue) {
  issues.push(issue);
}

function buildContinuationPrompt(foundIssues) {
  const issueLines = foundIssues
    .slice(0, 20)
    .map((issue) => `- ${issue.rule}: ${issue.filePath}:${issue.line} - ${issue.message}`)
    .join('\n');
  const extra =
    foundIssues.length > 20 ? `\n- ...and ${foundIssues.length - 20} more issue(s). Fix the same rule class before finalizing.` : '';

  return [
    'The Renku Studio final review hook found blocking architecture-rule violations.',
    '',
    issueLines + extra,
    '',
    'Before calling the work done, inspect these files, remove the violation, update callers directly, and rerun the relevant verification.',
  ].join('\n');
}

function git(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function emitContinue() {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

function emitBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}
