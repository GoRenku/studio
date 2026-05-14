import { getStudioCorePackageInfo } from '@gorenku/studio-core/client';
import type { RenkuCliIo } from '../cli.js';

export interface RenkuCliInfo {
  cli: '@gorenku/studio-cli';
  binary: 'renku';
  core: ReturnType<typeof getStudioCorePackageInfo>;
}

export function getRenkuCliInfo(): RenkuCliInfo {
  return {
    cli: '@gorenku/studio-cli',
    binary: 'renku',
    core: getStudioCorePackageInfo(),
  };
}

export async function runAboutCommand(options: {
  io: RenkuCliIo;
}): Promise<number> {
  options.io.stdout.log(JSON.stringify(getRenkuCliInfo(), null, 2));
  return 0;
}
