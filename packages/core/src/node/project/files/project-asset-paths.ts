import { joinProjectRelativePath, type ProjectRelativePath } from './project-relative-paths.js';

export const WORKING_ASSETS_BASE_ROOT = joinProjectRelativePath(
  'Working Assets',
  'Base'
);
export const WORKING_ASSETS_LOCALIZATION_ROOT = joinProjectRelativePath(
  'Working Assets',
  'Localization'
);
export const PRODUCTION_ASSETS_MASTER_ROOT = joinProjectRelativePath(
  'Production Assets',
  'Master'
);
export const PRODUCTION_ASSETS_LOCALIZED_ROOT = joinProjectRelativePath(
  'Production Assets',
  'Localized'
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
  | { kind: 'visualLanguage'; slug: string }
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
    return ['Narrative'];
  }
  if (target.kind === 'visualLanguage') {
    return ['Visual Language', target.slug];
  }
  if (target.kind === 'sequence') {
    return ['Sequences', target.sequenceSlug];
  }
  if (target.kind === 'scene') {
    return ['Sequences', target.sequenceSlug, 'Scenes', target.sceneSlug];
  }
  return [
    'Sequences',
    target.sequenceSlug,
    'Scenes',
    target.sceneSlug,
    'Clips',
    target.clipSlug,
  ];
}
