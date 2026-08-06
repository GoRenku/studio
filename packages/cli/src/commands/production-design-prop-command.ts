import {
  createProjectDataService,
  type PropDesignDocument,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import {
  readRequiredJsonInput,
  requiredFlag,
  writeJson,
} from './command-io.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

export async function runProductionDesignPropCommand(options: {
  subcommand?: string;
  flags: {
    file?: string;
    prop?: string;
    design?: string;
    active?: boolean;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number | null> {
  const service = createProjectDataService();
  if (options.subcommand === 'context') {
    writeJson(options.io, await service.readPropContext({
      homeDir: options.homeDir,
      propId: requiredFlag(options.flags.prop, '--prop'),
    }));
    return 0;
  }
  if (options.subcommand === 'list') {
    writeJson(options.io, await service.listPropDesigns({
      homeDir: options.homeDir,
      propId: requiredFlag(options.flags.prop, '--prop'),
    }));
    return 0;
  }
  if (options.subcommand === 'show') {
    writeJson(options.io, await service.readPropDesign({
      homeDir: options.homeDir,
      active: options.flags.active,
      propId: options.flags.prop,
      designId: options.flags.design,
    }));
    return 0;
  }
  if (options.subcommand === 'validate') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(
      filePath,
      'production-design prop validate'
    );
    writeJson(options.io, await service.validatePropDesign({
      homeDir: options.homeDir,
      document: document as PropDesignDocument,
      filePath: filePath !== '-' ? filePath : undefined,
    }));
    return 0;
  }
  if (options.subcommand === 'write') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(
      filePath,
      'production-design prop write'
    );
    const report = await service.writePropDesign({
      homeDir: options.homeDir,
      document: document as PropDesignDocument,
      filePath: filePath !== '-' ? filePath : undefined,
    });
    await appendStudioResourceChangedEvent({
      runtime: {
        homeDir: options.homeDir,
        json: options.json,
        io: options.io,
        projectDataService: service,
      },
      report,
      command: 'production-design prop write',
    });
    writeJson(options.io, report);
    return 0;
  }
  if (options.subcommand === 'set-active') {
    const report = await service.setActivePropDesign({
      homeDir: options.homeDir,
      propId: requiredFlag(options.flags.prop, '--prop'),
      designId: requiredFlag(options.flags.design, '--design'),
    });
    await appendStudioResourceChangedEvent({
      runtime: {
        homeDir: options.homeDir,
        json: options.json,
        io: options.io,
        projectDataService: service,
      },
      report,
      command: 'production-design prop set-active',
    });
    writeJson(options.io, report);
    return 0;
  }
  return null;
}
