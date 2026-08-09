import { useEffect } from 'react';
import { STUDIO_PROJECT_SETTINGS_RESOURCE_KEY } from '@gorenku/studio-core/client';

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
      resourceKey === 'navigation:props' ||
      resourceKey === 'screenplay' ||
      resourceKey === 'screenplay:structure'
  );
}

export function matchesMovieStudioNavigationResource(
  resourceKeys: string[]
): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'screenplay' ||
      resourceKey === 'screenplay:structure' ||
      resourceKey.startsWith('screenplay:section:') ||
      resourceKey === 'navigation:cast' ||
      resourceKey === 'navigation:locations' ||
      resourceKey === 'navigation:props'
  );
}

export function matchesProjectInformationResource(resourceKeys: string[]): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'project-information' || resourceKey === 'project-shell'
  );
}

export function matchesProjectSettingsResource(resourceKeys: string[]): boolean {
  return resourceKeys.includes(STUDIO_PROJECT_SETTINGS_RESOURCE_KEY);
}

export function matchesProjectLibraryResource(resourceKeys: string[]): boolean {
  return resourceKeys.includes('project-library');
}

export function matchesCastOverviewResource(resourceKeys: string[]): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'navigation:cast' ||
      resourceKey.startsWith('surface:castMember:')
  );
}

export function matchesCastMemberResource(
  resourceKeys: string[],
  castMemberId: string
): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === `surface:castMember:${castMemberId}`
  );
}

export function matchesLocationOverviewResource(resourceKeys: string[]): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'navigation:locations' ||
      resourceKey.startsWith('surface:location:')
  );
}

export function matchesLocationResource(
  resourceKeys: string[],
  locationId: string
): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === `surface:location:${locationId}`
  );
}

export function matchesPropOverviewResource(resourceKeys: string[]): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === 'navigation:props' ||
      resourceKey.startsWith('surface:prop:')
  );
}

export function matchesPropResource(
  resourceKeys: string[],
  propId: string
): boolean {
  return resourceKeys.includes(`surface:prop:${propId}`);
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
      resourceKey === 'screenplay:structure' ||
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
      resourceKey.startsWith('surface:castMember:') ||
      resourceKey.startsWith('surface:location:') ||
      resourceKey.startsWith('scene-dialogue-audio:') ||
      resourceKey.startsWith('scene-dialogue-audio-take:')
  );
}

export function matchesSceneVideoGenerationsResource(
  resourceKeys: string[],
  sceneId: string,
): boolean {
  return resourceKeys.includes(
    `surface:scene:${sceneId}:video-generations`,
  );
}

export function matchesSceneBeatsResource(input: {
  resourceKeys: string[];
  sceneId: string;
  sceneBeatsRevisionId?: string | null;
}): boolean {
  return input.resourceKeys.some(
    (resourceKey) =>
      resourceKey === `scene:${input.sceneId}` ||
      resourceKey === 'scene-beats' ||
      resourceKey === `surface:scene:${input.sceneId}:beats` ||
      resourceKey === `surface:scene:${input.sceneId}:dialogue-audio` ||
      resourceKey.startsWith('scene-dialogue-audio:') ||
      resourceKey.startsWith('scene-dialogue-audio-take:') ||
      (input.sceneBeatsRevisionId
        ? resourceKey.startsWith(`scene-beats:${input.sceneBeatsRevisionId}:`) ||
          resourceKey === `scene-beats:${input.sceneBeatsRevisionId}`
        : false)
  );
}
