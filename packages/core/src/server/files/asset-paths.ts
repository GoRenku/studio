import { joinProjectRelativePath } from './project-relative-paths.js';

export const WORKING_ASSETS_BASE_ROOT = joinProjectRelativePath(
  'working-assets',
  'base'
);
export const WORKING_ASSETS_LOCALIZATION_ROOT = joinProjectRelativePath(
  'working-assets',
  'localization'
);
export const PRODUCTION_ASSETS_MASTER_ROOT = joinProjectRelativePath(
  'production-assets',
  'master'
);
export const PRODUCTION_ASSETS_LOCALIZED_ROOT = joinProjectRelativePath(
  'production-assets',
  'localized'
);
