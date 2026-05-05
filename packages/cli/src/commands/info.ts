import { getMovieStudioPackageInfo } from '@gorenku/studio-core';

export interface RenkuCliInfo {
  cli: '@gorenku/studio-cli';
  binary: 'renku';
  core: ReturnType<typeof getMovieStudioPackageInfo>;
}

export function getRenkuCliInfo(): RenkuCliInfo {
  return {
    cli: '@gorenku/studio-cli',
    binary: 'renku',
    core: getMovieStudioPackageInfo(),
  };
}
