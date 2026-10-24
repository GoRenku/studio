import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { CastWardrobePlanDocument } from '../../../client/casting/model.js';
import { castingIssue } from '../diagnostics.js';

export interface CastWardrobePlanContext {
  sceneIds: ReadonlySet<string>;
  existingCostumeIds: ReadonlySet<string>;
  /** The Cast Member's Looks by id, with the scenes each covers. */
  lookScenes: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Every semantic issue in a wardrobe plan, collected before any write. */
export function castWardrobePlanIssues(document: CastWardrobePlanDocument, context: CastWardrobePlanContext): DiagnosticIssue[] {
  return [
    ...duplicateNameIssues(document),
    ...costumeIdIssues(document, context),
    ...lookIssues(document, context),
    ...sceneIssues(document, context),
  ];
}

function duplicateNameIssues(document: CastWardrobePlanDocument): DiagnosticIssue[] {
  const seen = new Set<string>();
  return document.costumes.flatMap((costume, index) => {
    const key = costume.name.trim().toLocaleLowerCase();
    const duplicate = seen.has(key);
    seen.add(key);
    return duplicate
      ? [castingIssue('CASTING_DUPLICATE_NAME', `Duplicate costume name: ${costume.name}.`, ['costumes', String(index), 'name'], 'Give every costume of a Cast Member its own name.')]
      : [];
  });
}

function costumeIdIssues(document: CastWardrobePlanDocument, context: CastWardrobePlanContext): DiagnosticIssue[] {
  const seen = new Set<string>();
  return document.costumes.flatMap((costume, index) => {
    if (!costume.id) {
      return [];
    }
    const duplicate = seen.has(costume.id);
    seen.add(costume.id);
    return duplicate || !context.existingCostumeIds.has(costume.id)
      ? [castingIssue('CASTING_COSTUME_NOT_FOUND', `Costume id is not one of this Cast Member's costumes: ${costume.id}.`, ['costumes', String(index), 'id'], 'Use ids from `renku cast wardrobe show`, or omit id to add a new costume.')]
      : [];
  });
}

function lookIssues(document: CastWardrobePlanDocument, context: CastWardrobePlanContext): DiagnosticIssue[] {
  return document.costumes.flatMap((costume, index) => context.lookScenes.has(costume.lookId)
    ? []
    : [castingIssue('CASTING_LOOK_NOT_FOUND', `Look is not one of this Cast Member's Looks: ${costume.lookId}.`, ['costumes', String(index), 'lookId'], 'Write the Looks first with `renku cast looks write`.')]);
}

function sceneIssues(document: CastWardrobePlanDocument, context: CastWardrobePlanContext): DiagnosticIssue[] {
  const owner = new Map<string, number>();
  return document.costumes.flatMap((costume, costumeIndex) => costume.sceneIds.flatMap((sceneId, sceneIndex) => {
    const path = ['costumes', String(costumeIndex), 'sceneIds', String(sceneIndex)];
    if (!context.sceneIds.has(sceneId)) {
      return [castingIssue('CASTING_UNKNOWN_SCENE', `Unknown scene: ${sceneId}.`, path, 'Use scene ids from the latest screenplay read command.')];
    }
    const lookScenes = context.lookScenes.get(costume.lookId);
    const issues: DiagnosticIssue[] = lookScenes && !lookScenes.has(sceneId)
      ? [castingIssue('CASTING_COSTUME_SCENE_OUTSIDE_LOOK', `Scene ${sceneId} is not one of the scenes of the costume's Look.`, path, 'Add the scene to the Look first, or pick a costume of the Look that covers it.')]
      : [];
    const earlier = owner.get(sceneId);
    owner.set(sceneId, costumeIndex);
    return earlier !== undefined && earlier !== costumeIndex
      ? [...issues, castingIssue('CASTING_COSTUME_SCENE_CONFLICT', `Scene ${sceneId} has two costumes: ${document.costumes[earlier]!.name} and ${costume.name}.`, path, 'A Cast Member wears one costume per scene.')]
      : issues;
  }));
}
