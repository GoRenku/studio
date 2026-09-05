import path from 'node:path';

export function normalizedProjectFileExtension(
  sourceProjectRelativePath: string,
  outputFormatHint?: string
): string {
  const hinted = outputFormatHint?.trim();
  const extension = hinted
    ? hinted.startsWith('.') ? hinted : `.${hinted}`
    : path.extname(sourceProjectRelativePath) || '.png';
  const normalized = safeExtension(extension.toLowerCase());
  return normalized === '.jpeg' ? '.jpg' : normalized;
}

function safeExtension(extension: string): string {
  let safe = '';
  for (const character of extension) {
    if (/[a-z0-9._+-]/u.test(character)) {
      safe += character;
      continue;
    }
    for (const byte of Buffer.from(character)) {
      safe += `%${byte.toString(16).padStart(2, '0')}`;
    }
  }
  return safe;
}
