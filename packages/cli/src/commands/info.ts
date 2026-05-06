import { getStudioCorePackageInfo } from '@gorenku/studio-core';

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
