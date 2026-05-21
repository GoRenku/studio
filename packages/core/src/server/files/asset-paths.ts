import type { ProjectRelativePath } from '../../client/index.js';
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

export function allocateWorkingMarkdownAssetPath(input: {
  target: MarkdownAssetPathTarget;
  fileName: string;
}): ProjectRelativePath {
  return joinProjectRelativePath(
    WORKING_ASSETS_BASE_ROOT,
    ...targetSegments(input.target),
    input.fileName
  );
}

export type MarkdownAssetPathTarget =
  | { kind: 'project' }
  | { kind: 'visualLanguage'; categorySlug: string; slug: string }
  | { kind: 'castMember'; slug: string }
  | { kind: 'continuityReference'; kindSlug: string; slug: string }
  | { kind: 'sequence'; sequenceSlug: string }
  | { kind: 'scene'; sequenceSlug: string; sceneSlug: string }
  | {
      kind: 'clip';
      sequenceSlug: string;
      sceneSlug: string;
      clipSlug: string;
    };

function targetSegments(target: MarkdownAssetPathTarget): string[] {
  if (target.kind === 'project') {
    return ['screenplay'];
  }
  if (target.kind === 'visualLanguage') {
    return ['visual-language', target.categorySlug, target.slug];
  }
  if (target.kind === 'castMember') {
    return ['cast', target.slug];
  }
  if (target.kind === 'continuityReference') {
    return ['continuity', target.kindSlug, target.slug];
  }
  if (target.kind === 'sequence') {
    return ['sequences', target.sequenceSlug];
  }
  if (target.kind === 'scene') {
    return ['sequences', target.sequenceSlug, 'scenes', target.sceneSlug];
  }
  return [
    'sequences',
    target.sequenceSlug,
    'scenes',
    target.sceneSlug,
    'clips',
    target.clipSlug,
  ];
}
