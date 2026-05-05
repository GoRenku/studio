import { getMovieStudioPackageInfo } from '@gorenku/studio-core';

export interface MovieCliInfo {
  cli: '@gorenku/studio-cli';
  core: ReturnType<typeof getMovieStudioPackageInfo>;
}

export function getMovieCliInfo(): MovieCliInfo {
  return {
    cli: '@gorenku/studio-cli',
    core: getMovieStudioPackageInfo(),
  };
}
