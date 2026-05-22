import { joinProjectRelativePath } from './project-relative-paths.js';

export const SCREENPLAY_ROOT = joinProjectRelativePath('screenplay');
export const CAST_ROOT = joinProjectRelativePath('cast');
export const LOCATIONS_ROOT = joinProjectRelativePath('locations');
export const PROPS_ROOT = joinProjectRelativePath('props');
export const VISUAL_LANGUAGE_ROOT = joinProjectRelativePath('visual-language');
export const SHOTLIST_ROOT = joinProjectRelativePath('shotlist');
export const PRODUCTION_ASSETS_MASTER_ROOT = joinProjectRelativePath(
  'production-assets',
  'master'
);
export const PRODUCTION_ASSETS_LOCALIZED_ROOT = joinProjectRelativePath(
  'production-assets',
  'localized'
);
