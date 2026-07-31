import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';
import { runProductionDesignLocationCommand } from './production-design-location-command.js';
import { runProductionDesignPropCommand } from './production-design-prop-command.js';

export async function runProductionDesignCommand(options: {
  input: string[];
  flags: {
    file?: string;
    location?: string;
    prop?: string;
    design?: string;
    active?: boolean;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [surface, subcommand] = options.input;
  if (surface === 'location') {
    const result = await runProductionDesignLocationCommand({
      ...options,
      subcommand,
    });
    if (result !== null) {
      return result;
    }
  }
  if (surface === 'prop') {
    const result = await runProductionDesignPropCommand({
      ...options,
      subcommand,
    });
    if (result !== null) {
      return result;
    }
  }
  throw new StructuredError({
    code: 'CLI121',
    message: 'Unknown production-design command.',
    issues: [
      createDiagnosticError(
        'CLI121',
        'Unknown production-design command.',
        { path: ['production-design', surface ?? '', subcommand ?? ''] },
        'Use location or prop with context/list/show/validate/write/set-active.'
      ),
    ],
    suggestion: 'Use a supported production-design command.',
  });
}
