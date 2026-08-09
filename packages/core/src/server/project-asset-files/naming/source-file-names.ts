import path from 'node:path';

export function normalizedProjectFileExtension(
  sourceProjectRelativePath: string,
  outputFormatHint?: string
): string {
  const hinted = outputFormatHint?.trim();
  const extension = hinted
    ? hinted.startsWith('.') ? hinted : `.${hinted}`
    : path.extname(sourceProjectRelativePath) || '.png';
  const normalized = extension.toLowerCase();
  return normalized === '.jpeg' ? '.jpg' : normalized;
}
