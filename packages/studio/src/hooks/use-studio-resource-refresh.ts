import { useEffect } from 'react';

export interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}

export type StudioResourceMatcher = (resourceKeys: string[]) => boolean;

export function useStudioResourceRefresh(input: {
  projectName: string;
  matches: StudioResourceMatcher;
  onRefresh: (detail: StudioResourceChangedDetail) => void | Promise<void>;
  enabled?: boolean;
}): void {
  const enabled = input.enabled ?? true;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== input.projectName) {
        return;
      }
      if (input.matches(detail.resourceKeys)) {
        void input.onRefresh(detail);
      }
    };

    window.addEventListener('renku:studio-resource-changed', handleResourceChanged);
    return () => {
      window.removeEventListener('renku:studio-resource-changed', handleResourceChanged);
    };
  }, [enabled, input]);
}

export function matchesProjectShellResource(resourceKeys: string[]): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'project-shell' ||
      resourceKey === 'project-information' ||
      resourceKey === 'navigation:cast' ||
      resourceKey === 'navigation:locations' ||
      resourceKey === 'screenplay' ||
      resourceKey === 'screenplay:acts'
  );
}

export function matchesProjectInformationResource(resourceKeys: string[]): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'project-information' || resourceKey === 'project-shell'
  );
}

export function matchesProjectLibraryResource(resourceKeys: string[]): boolean {
  return resourceKeys.includes('project-library');
}

export function matchesCastOverviewResource(resourceKeys: string[]): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'navigation:cast' ||
      resourceKey.startsWith('assets:castMember:') ||
      resourceKey.startsWith('surface:castMember:')
  );
}

export function matchesCastMemberResource(
  resourceKeys: string[],
  castMemberId: string
): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === `assets:castMember:${castMemberId}` ||
      resourceKey === `surface:castMember:${castMemberId}` ||
      resourceKey === `surface:castDesign:${castMemberId}`
  );
}

export function matchesLocationOverviewResource(resourceKeys: string[]): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'navigation:locations' ||
      resourceKey.startsWith('assets:location:') ||
      resourceKey.startsWith('surface:location:')
  );
}

export function matchesLocationResource(
  resourceKeys: string[],
  locationId: string
): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === `assets:location:${locationId}` ||
      resourceKey === `surface:location:${locationId}` ||
      resourceKey === `surface:locationDesign:${locationId}`
  );
}

export function matchesVisualLanguageInspirationResource(
  resourceKeys: string[],
  folderId?: string | null
): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'surface:visual-language:inspiration' ||
      (folderId
        ? resourceKey === `surface:visual-language:inspiration:${folderId}`
        : false)
  );
}

export function matchesVisualLanguageLookbooksResource(
  resourceKeys: string[]
): boolean {
  return resourceKeys.includes('surface:visual-language:lookbooks');
}

export function matchesVisualLanguageLookbookResource(
  resourceKeys: string[],
  lookbookId: string
): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'surface:visual-language:lookbooks' ||
      resourceKey === `surface:visual-language:lookbook:${lookbookId}`
  );
}

export function matchesStoryArcResource(resourceKeys: string[]): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'surface:story-arc' ||
      resourceKey === 'screenplay' ||
      resourceKey === 'screenplay:acts' ||
      resourceKey === 'screenplay-analysis' ||
      resourceKey.startsWith('screenplay-analysis:')
  );
}

export function matchesSceneNarrativeResource(
  resourceKeys: string[],
  sceneId: string
): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'screenplay' ||
      resourceKey === `scene:${sceneId}` ||
      resourceKey === `surface:scene:${sceneId}:dialogue-audio` ||
      resourceKey.startsWith('scene-dialogue-audio:') ||
      resourceKey.startsWith('scene-dialogue-audio-take:')
  );
}

export function matchesSceneShotsResource(input: {
  resourceKeys: string[];
  sceneId: string;
  shotListId?: string | null;
}): boolean {
  return input.resourceKeys.some(
    (resourceKey) =>
      resourceKey === `scene:${input.sceneId}` ||
      resourceKey === 'scene-shot-list' ||
      resourceKey === `surface:scene:${input.sceneId}:shots` ||
      resourceKey === `surface:scene:${input.sceneId}:dialogue-audio` ||
      resourceKey.startsWith('scene-dialogue-audio:') ||
      resourceKey.startsWith('scene-dialogue-audio-take:') ||
      resourceKey.startsWith('scene-shot-video-take-group:') ||
      resourceKey.startsWith('scene-shot-video-take-input:') ||
      (input.shotListId
        ? resourceKey.startsWith(`scene-shot-list:${input.shotListId}:`) ||
          resourceKey === `scene-shot-list:${input.shotListId}`
        : false)
  );
}

export function matchesSequenceResource(input: {
  resourceKeys: string[];
  sequenceId: string;
  sceneIds: Set<string>;
}): boolean {
  return input.resourceKeys.some((resourceKey) => {
    if (
      resourceKey === 'screenplay' ||
      resourceKey === `surface:sequence:${input.sequenceId}` ||
      resourceKey === `navigation:sequence-scenes:${input.sequenceId}`
    ) {
      return true;
    }
    return matchesStoryboardSceneResource(resourceKey, input.sceneIds);
  });
}

export function matchesActStoryboardResource(input: {
  resourceKeys: string[];
  actId: string;
  sequenceIds: Set<string>;
  sceneIds: Set<string>;
}): boolean {
  return input.resourceKeys.some((resourceKey) => {
    if (
      resourceKey === 'screenplay' ||
      resourceKey === 'screenplay:acts' ||
      resourceKey === `surface:act:${input.actId}` ||
      [...input.sequenceIds].some(
        (sequenceId) =>
          resourceKey === `surface:sequence:${sequenceId}` ||
          resourceKey === `navigation:sequence-scenes:${sequenceId}`
      )
    ) {
      return true;
    }
    return matchesStoryboardSceneResource(resourceKey, input.sceneIds);
  });
}

function matchesStoryboardSceneResource(
  resourceKey: string,
  sceneIds: Set<string>
): boolean {
  if (
    resourceKey === 'scene-shot-list' ||
    resourceKey.startsWith('scene-shot-list:')
  ) {
    return true;
  }
  for (const sceneId of sceneIds) {
    if (
      resourceKey === `scene:${sceneId}` ||
      resourceKey === `surface:scene:${sceneId}:shots`
    ) {
      return true;
    }
  }
  return false;
}
