import {
  createProjectDataService,
  type LocationDesignDocument,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import {
  readRequiredJsonInput,
  requiredFlag,
  writeJson,
} from './department-command-io.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

export async function runProductionDesignLocationCommand(options: {
  subcommand?: string;
  flags: {
    file?: string;
    location?: string;
    design?: string;
    active?: boolean;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number | null> {
  const service = createProjectDataService();
  if (options.subcommand === 'context') {
    writeJson(options.io, await service.readLocationContext({
      homeDir: options.homeDir,
      locationId: requiredFlag(options.flags.location, '--location'),
    }));
    return 0;
  }
  if (options.subcommand === 'list') {
    writeJson(options.io, await service.listLocationDesigns({
      homeDir: options.homeDir,
      locationId: requiredFlag(options.flags.location, '--location'),
    }));
    return 0;
  }
  if (options.subcommand === 'show') {
    writeJson(options.io, await service.readLocationDesign({
      homeDir: options.homeDir,
      active: options.flags.active,
      locationId: options.flags.location,
      designId: options.flags.design,
    }));
    return 0;
  }
  if (options.subcommand === 'validate') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(
      filePath,
      'production-design location validate'
    );
    writeJson(options.io, await service.validateLocationDesign({
      homeDir: options.homeDir,
      document: document as LocationDesignDocument,
      filePath: filePath !== '-' ? filePath : undefined,
    }));
    return 0;
  }
  if (options.subcommand === 'write') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readRequiredJsonInput(
      filePath,
      'production-design location write'
    );
    const report = await service.writeLocationDesign({
      homeDir: options.homeDir,
      document: document as LocationDesignDocument,
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
      command: 'production-design location write',
    });
    writeJson(options.io, report);
    return 0;
  }
  if (options.subcommand === 'set-active') {
    const report = await service.setActiveLocationDesign({
      homeDir: options.homeDir,
      locationId: requiredFlag(options.flags.location, '--location'),
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
      command: 'production-design location set-active',
    });
    writeJson(options.io, report);
    return 0;
  }
  return null;
}
