import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { CastLooksPlanDocument } from '../../../client/casting/model.js';
import { castingIssue } from '../diagnostics.js';

export interface CastLooksPlanContext {
  sceneIds: ReadonlySet<string>;
  existingLookIds: ReadonlySet<string>;
  /** Existing Looks that cannot be removed, with what still depends on them. */
  lookDependencies: ReadonlyMap<string, string[]>;
  /** Scenes the existing costumes of each Look wear, which the Look must keep. */
  costumeScenesByLook: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Every semantic issue in a Looks plan, collected before any write. */
export function castLooksPlanIssues(document: CastLooksPlanDocument, context: CastLooksPlanContext): DiagnosticIssue[] {
  return [
    ...duplicateNameIssues(document),
    ...lookIdIssues(document, context),
    ...sceneIssues(document, context),
    ...removedLookIssues(document, context),
    ...costumeSceneIssues(document, context),
  ];
}

function duplicateNameIssues(document: CastLooksPlanDocument): DiagnosticIssue[] {
  const seen = new Set<string>();
  return document.looks.flatMap((look, index) => {
    const key = look.name.trim().toLocaleLowerCase();
    const duplicate = seen.has(key);
    seen.add(key);
    return duplicate
      ? [castingIssue('CASTING_DUPLICATE_NAME', `Duplicate Look name: ${look.name}.`, ['looks', String(index), 'name'], 'Give every Look of a Cast Member its own name.')]
      : [];
  });
}

function lookIdIssues(document: CastLooksPlanDocument, context: CastLooksPlanContext): DiagnosticIssue[] {
  const seen = new Set<string>();
  return document.looks.flatMap((look, index) => {
    if (!look.id) {
      return [];
    }
    const duplicate = seen.has(look.id);
    seen.add(look.id);
    if (duplicate || !context.existingLookIds.has(look.id)) {
      return [castingIssue('CASTING_LOOK_NOT_FOUND', `Look id is not one of this Cast Member's Looks: ${look.id}.`, ['looks', String(index), 'id'], 'Use ids from `renku cast looks show`, or omit id to add a new Look.')];
    }
    return [];
  });
}

function sceneIssues(document: CastLooksPlanDocument, context: CastLooksPlanContext): DiagnosticIssue[] {
  const owner = new Map<string, number>();
  return document.looks.flatMap((look, lookIndex) => look.sceneIds.flatMap((sceneId, sceneIndex) => {
    const path = ['looks', String(lookIndex), 'sceneIds', String(sceneIndex)];
    if (!context.sceneIds.has(sceneId)) {
      return [castingIssue('CASTING_UNKNOWN_SCENE', `Unknown scene: ${sceneId}.`, path, 'Use scene ids from the latest screenplay read command.')];
    }
    const earlier = owner.get(sceneId);
    owner.set(sceneId, lookIndex);
    return earlier !== undefined && earlier !== lookIndex
      ? [castingIssue('CASTING_LOOK_SCENE_CONFLICT', `Scene ${sceneId} is in two Looks: ${document.looks[earlier]!.name} and ${look.name}.`, path, 'A scene belongs to at most one Look of a Cast Member.')]
      : [];
  }));
}

function removedLookIssues(document: CastLooksPlanDocument, context: CastLooksPlanContext): DiagnosticIssue[] {
  const kept = new Set(document.looks.flatMap((look) => look.id ? [look.id] : []));
  return [...context.existingLookIds].filter((id) => !kept.has(id)).flatMap((id) => {
    const dependencies = context.lookDependencies.get(id) ?? [];
    return dependencies.length > 0
      ? [castingIssue('CASTING_LOOK_IN_USE', `Look ${id} still has ${dependencies.join(', ')}.`, ['looks'], 'Keep the Look by passing its id, or move its costumes in the wardrobe plan first.')]
      : [];
  });
}

function costumeSceneIssues(document: CastLooksPlanDocument, context: CastLooksPlanContext): DiagnosticIssue[] {
  return document.looks.flatMap((look, index) => {
    const worn = look.id ? context.costumeScenesByLook.get(look.id) : undefined;
    const scenes = new Set(look.sceneIds);
    const dropped = [...(worn ?? [])].filter((sceneId) => !scenes.has(sceneId));
    return dropped.length > 0
      ? [castingIssue('CASTING_COSTUME_SCENE_OUTSIDE_LOOK', `Look ${look.name} would drop scenes its costumes still wear: ${dropped.join(', ')}.`, ['looks', String(index), 'sceneIds'], 'Move those scenes to another costume in the wardrobe plan first.')]
      : [];
  });
}
