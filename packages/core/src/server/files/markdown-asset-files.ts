import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectRelativePath } from '../../client/index.js';
import { resolveProjectRelativePath } from './project-relative-paths.js';

export async function writeMarkdownAssetFile(input: {
  projectFolder: string;
  projectRelativePath: ProjectRelativePath;
  content: string;
}): Promise<void> {
  const absolutePath = resolveProjectRelativePath(
    input.projectFolder,
    input.projectRelativePath
  );
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, normalizeMarkdownContent(input.content), 'utf8');
}

export async function writeMarkdownAssetFileContent(input: {
  projectFolder: string;
  projectRelativePath: ProjectRelativePath;
  content: string;
}): Promise<void> {
  const absolutePath = resolveProjectRelativePath(
    input.projectFolder,
    input.projectRelativePath
  );
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.content, 'utf8');
}

export async function readMarkdownAssetFile(input: {
  projectFolder: string;
  projectRelativePath: ProjectRelativePath;
}): Promise<string> {
  const absolutePath = resolveProjectRelativePath(
    input.projectFolder,
    input.projectRelativePath
  );
  return (await fs.readFile(absolutePath, 'utf8')).trimEnd();
}

export async function readMarkdownAssetFileContent(input: {
  projectFolder: string;
  projectRelativePath: ProjectRelativePath;
}): Promise<string> {
  const absolutePath = resolveProjectRelativePath(
    input.projectFolder,
    input.projectRelativePath
  );
  return await fs.readFile(absolutePath, 'utf8');
}

function normalizeMarkdownContent(content: string): string {
  const trimmed = content.trim();
  return trimmed.length === 0 ? '' : `${trimmed}\n`;
}
