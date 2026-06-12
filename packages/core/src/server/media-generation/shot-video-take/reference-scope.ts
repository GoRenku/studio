import {
  listSceneLocationIds,
} from '../../database/access/navigation.js';
import {
  readSceneShotListDocument,
} from '../../database/access/scene-shot-lists.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  requireSceneHierarchy,
  requireScreenplayDocument,
} from './project-session.js';



export type SceneReferenceScope = {
  castMembers: NonNullable<ReturnType<typeof requireScreenplayDocument>['cast']>;
  locations: NonNullable<ReturnType<typeof requireScreenplayDocument>['locations']>;
};



export function sceneNarrativeReferenceScope(input: {
  session: DatabaseSession;
  screenplay: ReturnType<typeof requireScreenplayDocument>;
  sceneId: string;
}): SceneReferenceScope {
  const hierarchy = requireSceneHierarchy(input.screenplay, input.sceneId);
  const castMemberIds: string[] = [];
  const locationIds: string[] = [];
  addOrderedIds(locationIds, hierarchy.scene.setting.locationIds ?? []);
  addOrderedIds(locationIds, sceneLocationIds(input.session, input.sceneId));
  hierarchy.scene.blocks.forEach((block) => {
    if ('castMemberId' in block && block.castMemberId) {
      addOrderedIds(castMemberIds, [block.castMemberId]);
    }
    addOrderedIds(castMemberIds, block.castMemberIds ?? []);
    addOrderedIds(locationIds, block.locationIds ?? []);
  });
  return {
    castMembers: orderedScreenplayItems(input.screenplay.cast, castMemberIds),
    locations: orderedScreenplayItems(input.screenplay.locations, locationIds),
  };
}



export function sceneShotReferenceScope(input: {
  screenplay: ReturnType<typeof requireScreenplayDocument>;
  narrativeScope: SceneReferenceScope;
  shotList: ReturnType<typeof readSceneShotListDocument>;
}): SceneReferenceScope {
  const castMemberIds: string[] = [];
  const locationIds: string[] = [];
  addOrderedIds(
    castMemberIds,
    input.narrativeScope.castMembers.flatMap((castMember) =>
      castMember.id ? [castMember.id] : []
    )
  );
  addOrderedIds(
    locationIds,
    input.narrativeScope.locations.flatMap((location) =>
      location.id ? [location.id] : []
    )
  );
  input.shotList.shots.forEach((shot) => {
    addOrderedIds(castMemberIds, shot.castMemberIds);
    addOrderedIds(castMemberIds, shot.shotSpecs?.castReferences?.castMemberIds ?? []);
    addOrderedIds(locationIds, shot.locationIds);
    if (shot.shotSpecs?.location?.locationId) {
      addOrderedIds(locationIds, [shot.shotSpecs.location.locationId]);
    }
  });
  return {
    castMembers: orderedScreenplayItems(input.screenplay.cast, castMemberIds),
    locations: orderedScreenplayItems(input.screenplay.locations, locationIds),
  };
}



export function sceneLocationIds(session: DatabaseSession, sceneId: string): string[] {
  return listSceneLocationIds(session, sceneId);
}



export function orderedScreenplayItems<T extends { id?: string }>(
  items: T[],
  orderedIds: string[]
): T[] {
  const byId = new Map(items.flatMap((item) => (item.id ? [[item.id, item]] : [])));
  const seen = new Set<string>();
  const ordered = orderedIds.flatMap((id) => {
    const item = byId.get(id);
    if (!item || seen.has(id)) {
      return [];
    }
    seen.add(id);
    return [item];
  });
  return ordered;
}



export function addOrderedIds(target: string[], ids: string[]): void {
  const seen = new Set(target);
  ids.forEach((id) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      target.push(id);
    }
  });
}
