import path from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';

export const RENKU_NODE_RANGE = '^22.23.4 || ^24.22.1';

export function isSupportedNodeVersion(version = process.versions.node): boolean {
  const [major, minor, patch] = version.split('.').map(Number);
  if (minor === undefined || patch === undefined) {
    return false;
  }
  return (
    (major === 24 && (minor > 22 || (minor === 22 && patch >= 1))) ||
    (major === 22 && (minor > 23 || (minor === 23 && patch >= 4)))
  );
}

export function isRenkuCliEntrypoint(argvPath: string | undefined): boolean {
  if (!argvPath) {
    return false;
  }
  const moduleEntrypoint = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'cli.js'
  );
  return canonicalizeEntrypoint(argvPath) === canonicalizeEntrypoint(moduleEntrypoint);
}

function canonicalizeEntrypoint(entrypoint: string): string {
  const absolute = path.resolve(entrypoint);
  if (existsSync(absolute)) {
    return realpathSync(absolute);
  }
  return path.join(realpathSync(path.dirname(absolute)), path.basename(absolute));
}

export function requireSupportedNodeVersion(): void {
  if (!isSupportedNodeVersion()) {
    const message = `Renku requires Node ${RENKU_NODE_RANGE}; current runtime is ${process.versions.node}.`;
    throw new StructuredError({
      code: 'CLI160',
      message,
      suggestion: 'Re-run the Renku installer to install its private runtime.',
      issues: [
        createDiagnosticError(
          'CLI160',
          message,
          { path: ['runtime', 'node'], context: 'Renku process runtime' },
          'Re-run the Renku installer to install its private runtime.'
        ),
      ],
    });
  }
}
