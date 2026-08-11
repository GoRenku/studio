import { getStudioCorePackageInfo } from '@gorenku/studio-core/client';
import packageJson from '../../package.json' with { type: 'json' };
import type { RenkuCliIo } from '../cli.js';

export interface RenkuCliInfo {
  cli: '@gorenku/studio-cli';
  binary: 'renku';
  version: string;
  core: ReturnType<typeof getStudioCorePackageInfo>;
}

export function getRenkuCliInfo(): RenkuCliInfo {
  return {
    cli: '@gorenku/studio-cli',
    binary: 'renku',
    version: packageJson.version,
    core: getStudioCorePackageInfo(),
  };
}

export async function runAboutCommand(options: {
  io: RenkuCliIo;
}): Promise<number> {
  options.io.stdout.log(JSON.stringify(getRenkuCliInfo(), null, 2));
  return 0;
}
