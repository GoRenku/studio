import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import type { createProjectDataService } from '@gorenku/studio-core/server';

type ProjectDataService = ReturnType<typeof createProjectDataService>;

export async function runScreenplaySceneNumberCommand(options: {
  subcommand?: string;
  productionNumber?: string;
  homeDir?: string;
  service: ProjectDataService;
}) {
  if (options.subcommand === 'list') {
    return await options.service.listSceneProductionNumbers({
      homeDir: options.homeDir,
    });
  }
  if (options.subcommand === 'resolve') {
    return await options.service.resolveSceneProductionNumber({
      homeDir: options.homeDir,
      productionNumber: requiredNumber(options.productionNumber),
    });
  }
  throw new StructuredError({
    code: 'CLI081',
    message: 'Unknown screenplay scene-number command.',
    issues: [
      createDiagnosticError(
        'CLI081',
        'Unknown screenplay scene-number command.',
        { path: ['screenplay', 'scene-number', options.subcommand ?? ''] },
        'Use `scene-number list` or `scene-number resolve --number <production-number>`.'
      ),
    ],
    suggestion: 'Use a supported screenplay scene-number command.',
  });
}

function requiredNumber(value: string | undefined): string {
  if (value?.trim()) {
    return value;
  }
  throw new StructuredError({
    code: 'CLI090',
    message: '--number is required.',
    issues: [
      createDiagnosticError(
        'CLI090',
        '--number is required.',
        { path: ['--number'], context: 'renku CLI arguments' },
        'Pass --number <production-number>.'
      ),
    ],
    suggestion: 'Pass --number <production-number>.',
  });
}
