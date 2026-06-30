import type {
  ShotVideoTakeInputKind,
  ShotVideoTakeProductionContext,
  ShotVideoTakePreflightInput,
  SceneShotVideoTakeMediaInput,
  ShotVideoTakePreflightDependency,
  ShotVideoTakeOutputGenerationPlan,
  ShotVideoTakePreflightInputItem,
  MediaGenerationPlanLine,
  MediaGenerationDependencyLine,
  ProjectRelativePath,
  MediaGenerationDependencyInventory,
} from '../../../client/index.js';
import {
  readAssetFileRecord,
} from '../../database/access/asset-files.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../../database/access/asset-relationships/index.js';
import { readScreenplaySceneFromSession } from '../../database/access/screenplay-resource.js';
import {
  listLookbookSheets,
  readLookbookSheetRecord,
  readLookbookSheet,
} from '../../database/access/lookbook-sheets.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  shotVideoInputDependencyId,
  parseShotVideoInputDependencyId,
} from '../dependency-identifiers.js';
import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  issue,
} from './diagnostics.js';
import {
  resolveShotDialogueAudioReferences,
} from './dialogue-audio-references.js';
import {
  generationReferenceInclusionForDependencyId,
} from './reference-inclusions.js';
import {
  selectedLocationSheetAssetIdsForGenerationTakeState,
  selectedLookbookSheetIdsForGenerationTakeState,
} from './reference-selection.js';
import {
  requireScreenplayDocument,
} from './project-session.js';



export const SHOT_VIDEO_TAKE_INPUT_KIND_LABELS: Record<ShotVideoTakeInputKind, string> = {
  'first-frame': 'First frame',
  'last-frame': 'Last frame',
  'reference-image': 'Reference image',
  'character-sheet': 'Character sheet',
  'location-sheet': 'Location sheet',
  'lookbook-sheet': 'Lookbook sheet',
  'video-prompt-sheet': 'Video prompt sheet',
  'source-video': 'Source video',
  audio: 'Audio',
};



export function buildShotVideoTakePreflightInputItems(input: {
  context: ShotVideoTakeProductionContext;
  preparedInputs: ShotVideoTakePreflightInput[];
  mediaInputs: SceneShotVideoTakeMediaInput[];
  inputsToCreate: ShotVideoTakePreflightDependency[];
  plan: ShotVideoTakeOutputGenerationPlan;
}): ShotVideoTakePreflightInputItem[] {
  const items: ShotVideoTakePreflightInputItem[] = [];

  const candidatesByDependencyId = new Map<string, SceneShotVideoTakeMediaInput[]>();
  input.mediaInputs.forEach((mediaInput) => {
    const key = shotVideoInputDependencyId({
      kind: mediaInput.kind,
      subjectKind: mediaInput.subjectKind,
      subjectId: mediaInput.subjectId,
    });
    candidatesByDependencyId.set(key, [
      ...(candidatesByDependencyId.get(key) ?? []),
      mediaInput,
    ]);
  });

  input.plan.lines.forEach((line) => {
    if (line.kind === 'final-video-generation') {
      return;
    }
    const dependencyId = line.dependencyId;
    const candidates = dependencyId ? (candidatesByDependencyId.get(dependencyId) ?? []) : [];
    const selected = candidates.find((candidate) => candidate.selected);
    const prepared = dependencyId
      ? input.preparedInputs.find(
          (candidate) =>
            shotVideoInputDependencyId({
              kind: candidate.kind,
              subjectKind: candidate.subjectKind,
              subjectId: candidate.subjectId,
            }) === dependencyId
        )
      : undefined;
    const source = prepared ?? selected;
    items.push({
      key: line.id,
      title: inputItemTitle(input.context, line),
      caption: inputItemCaption(line),
      mediaKind: line.mediaKind as 'image' | 'audio' | 'video',
      status: itemStatusForLine(line, Boolean(selected)),
      ...(source
        ? {
            assetId: source.assetId,
            assetFileId: source.assetFileId,
            projectRelativePath: source.projectRelativePath,
          }
        : {}),
      planLineId: line.id,
      dependencyLineId: line.dependencyLineId,
      purpose: line.purpose,
      pricing: line.pricing,
      ...slotForPlanLine(line),
      candidates:
        candidates.length > 0
          ? candidates.map((candidate, index) => ({
              inputId: candidate.inputId,
              label: `${inputKindLabel(candidate.kind)} ${index + 1}`,
            }))
          : undefined,
      selectedInputId: selected?.inputId ?? null,
    });
  });

  return items;
}



export function itemStatusForLine(
  line: MediaGenerationPlanLine,
  hasAvailableCandidate: boolean
): ShotVideoTakePreflightInputItem['status'] {
  if (line.kind === 'reused-asset') {
    return 'ready';
  }
  if (hasAvailableCandidate) {
    return 'available';
  }
  return 'needed';
}



export function inputItemTitle(
  context: ShotVideoTakeProductionContext,
  line: MediaGenerationPlanLine
): string {
  const target = dependencyTargetForLine(context, line);
  if (target?.kind === 'castMember') {
    return context.selectedCast.find((castMember) => castMember.id === target.id)?.name ??
      line.label;
  }
  if (target?.kind === 'location') {
    return context.selectedLocations.find((location) => location.id === target.id)?.name ??
      line.label;
  }
  if (target?.kind === 'lookbook') {
    return context.activeLookbook?.id === target.id ? context.activeLookbook.name : line.label;
  }
  const parsed = parseShotVideoInputDependencyId(line.dependencyId);
  return inputKindLabel(parsed.ok ? parsed.value.kind : 'reference-image');
}



export function inputItemCaption(line: MediaGenerationPlanLine): string {
  if (line.dependencyKind === 'cast-character-sheet') {
    return 'Character sheet';
  }
  if (line.dependencyKind === 'location-environment-sheet') {
    return 'Location sheet';
  }
  if (line.dependencyKind === 'lookbook-sheet') {
    return 'Lookbook sheet';
  }
  const parsed = parseShotVideoInputDependencyId(line.dependencyId);
  if (parsed.ok) {
    return inputKindLabel(parsed.value.kind);
  }
  return line.label;
}



export function slotForPlanLine(
  line: MediaGenerationPlanLine
): Pick<ShotVideoTakePreflightInputItem, 'slot'> {
  const parsed = parseShotVideoInputDependencyId(line.dependencyId);
  if (!parsed.ok) {
    return {};
  }
  return {
    slot: {
      kind: parsed.value.kind,
      ...(parsed.value.subjectKind ? { subjectKind: parsed.value.subjectKind } : {}),
      ...(parsed.value.subjectId ? { subjectId: parsed.value.subjectId } : {}),
    },
  };
}



export function dependencyTargetForLine(
  context: ShotVideoTakeProductionContext,
  line: MediaGenerationPlanLine
): MediaGenerationDependencyLine['target'] {
  if (!line.dependencyId) {
    return null;
  }
  const parsed = parseShotVideoInputDependencyId(line.dependencyId);
  if (parsed.ok && parsed.value.subjectKind === 'cast-member' && parsed.value.subjectId) {
    return { kind: 'castMember', id: parsed.value.subjectId };
  }
  if (parsed.ok && parsed.value.subjectKind === 'location' && parsed.value.subjectId) {
    return { kind: 'location', id: parsed.value.subjectId };
  }
  if (parsed.ok && parsed.value.subjectKind === 'lookbook' && parsed.value.subjectId) {
    return { kind: 'lookbook', id: parsed.value.subjectId };
  }
  return context.target;
}



export function inputKindLabel(kind: ShotVideoTakeInputKind): string {
  return SHOT_VIDEO_TAKE_INPUT_KIND_LABELS[kind] ?? kind;
}



export function preparedInputsForContext(
  context: ShotVideoTakeProductionContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[]
): ShotVideoTakePreflightInput[] {
  const inputs: Array<ShotVideoTakePreflightInput | null> = (context.take.state.production.preparedInputs ?? [])
    .map((input) => {
      const available = context.mediaInputs.find(
        (candidate) =>
          candidate.assetId === input.assetId &&
          candidate.assetFileId === input.assetFileId &&
          candidate.kind === input.kind
      );
      const assetFile = available ?? (input.assetFileId
        ? readAssetFileRecord(session, {
            assetId: input.assetId,
            assetFileId: input.assetFileId,
          })
        : null);
      if (!assetFile) {
        issues.push(
          issue(
            'PROJECT_DATA378',
            'Prepared shot video take input does not resolve to an asset file.',
            ['take', 'production', 'preparedInputs'],
            'Select an existing reusable input or import the missing dependency again.'
          )
        );
        return null;
      }
      return {
        kind: input.kind,
        assetId: input.assetId,
        assetFileId: available ? available.assetFileId : input.assetFileId as string,
        role: 'role' in assetFile ? assetFile.role : input.kind as string,
        mediaKind: assetFile.mediaKind as 'image' | 'audio' | 'video',
        projectRelativePath: assetFile.projectRelativePath as ProjectRelativePath,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
      };
    });
  return [
    ...inputs.filter((input): input is ShotVideoTakePreflightInput => Boolean(input)),
    ...locationSheetInputsForContext(context, session, issues),
    ...lookbookSheetInputsForContext(context, session, issues),
    ...dialogueAudioInputsForContext(context, session, issues),
  ];
}

export function locationSheetInputsForContext(
  context: ShotVideoTakeProductionContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[]
): ShotVideoTakePreflightInput[] {
  const inputs: ShotVideoTakePreflightInput[] = [];
  for (const location of context.selectedLocations) {
    const selectedAssetIds = selectedLocationSheetAssetIdsForGenerationTakeState(
      context.take.state,
      context.take.shotIds,
      location.id
    );
    const assets = listAssetRelationshipPage(session, {
      target: { kind: 'location', locationId: location.id },
      role: 'environment_sheet',
      mediaKind: 'image',
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items;
    const assetsById = new Map(assets.map((asset) => [asset.assetId, asset]));
    for (const assetId of selectedAssetIds) {
      const asset = assetsById.get(assetId);
      if (!asset) {
        issues.push(
          issue(
            'PROJECT_DATA418',
            'Selected Location Sheet does not belong to the referenced Location.',
            [
              'take',
              'state',
              'structure',
              'selectedLocationSheetAssetIds',
              location.id,
            ],
            'Choose a Location Sheet attached to this Location.'
          )
        );
        continue;
      }
      const file = asset.files.find(
        (candidate) => candidate.mediaKind === 'image' && candidate.role === 'primary'
      );
      if (!file) {
        issues.push(
          issue(
            'PROJECT_DATA419',
            'Selected Location Sheet has no primary image file.',
            [
              'take',
              'state',
              'structure',
              'selectedLocationSheetAssetIds',
              location.id,
            ],
            'Regenerate or import the Location Sheet with one primary image file.'
          )
        );
        continue;
      }
      inputs.push({
        kind: 'location-sheet',
        assetId: asset.assetId,
        assetFileId: file.id,
        role: file.role,
        mediaKind: 'image',
        projectRelativePath: file.projectRelativePath,
        subjectKind: 'location',
        subjectId: location.id,
      });
    }
  }
  return inputs;
}

export function dialogueAudioInputsForContext(
  context: ShotVideoTakeProductionContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[]
): ShotVideoTakePreflightInput[] {
  const screenplay = requireScreenplayDocument(session);
  const scene = readScreenplaySceneFromSession(session, context.scene.id);
  const resolved = resolveShotDialogueAudioReferences({
    session,
    screenplay,
    scene,
    context,
  });
  issues.push(...resolved.diagnostics);
  const inputs = new Map<string, ShotVideoTakePreflightInput>();
  for (const reference of resolved.references) {
    const inclusion = generationReferenceInclusionForDependencyId(
      context,
      reference.dependencyId,
      reference.defaultIncluded
    );
    if (!inclusion.included) {
      continue;
    }
    if (!reference.pickedTake) {
      if (reference.audioState !== 'not-generated') {
        issues.push(...reference.diagnostics);
      }
      continue;
    }
    const file = readAssetFileRecord(session, {
      assetId: reference.pickedTake.assetId,
      assetFileId: reference.pickedTake.assetFileId,
    });
    if (!file) {
      issues.push(...reference.diagnostics);
      continue;
    }
    const key = `${reference.dialogueId}:${reference.pickedTake.assetFileId}`;
    if (inputs.has(key)) {
      continue;
    }
    inputs.set(key, {
      kind: 'audio',
      assetId: reference.pickedTake.assetId,
      assetFileId: reference.pickedTake.assetFileId,
      role: 'dialogue_audio',
      mediaKind: 'audio',
      projectRelativePath: file.projectRelativePath as ProjectRelativePath,
      subjectKind: 'scene-dialogue',
      subjectId: reference.dialogueId,
    });
  }
  return [...inputs.values()];
}



export function lookbookSheetInputsForContext(
  context: ShotVideoTakeProductionContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[]
): ShotVideoTakePreflightInput[] {
  if (!context.activeLookbook) {
    return [];
  }
  const selectedIds = selectedLookbookSheetIdsForGenerationTakeState(
    context.take.state,
    context.take.shotIds
  );
  if (selectedIds.size === 0) {
    const defaultSheet = listLookbookSheets(session, context.activeLookbook.id)[0];
    if (defaultSheet) {
      selectedIds.add(defaultSheet.id);
    }
  }
  return [...selectedIds]
    .map((sheetId) =>
      lookbookSheetInputForId(context, session, issues, sheetId)
    )
    .filter((input): input is ShotVideoTakePreflightInput => Boolean(input));
}



export function lookbookSheetInputForId(
  context: ShotVideoTakeProductionContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[],
  sheetId: string
): ShotVideoTakePreflightInput | null {
  const record = readLookbookSheetRecord(session, sheetId);
  if (!record || record.lookbookId !== context.activeLookbook?.id) {
    issues.push(
      issue(
        'PROJECT_DATA412',
        'Selected lookbook sheet does not belong to the active lookbook.',
        ['take', 'state', 'structure', 'selectedLookbookSheetIds'],
        'Choose a lookbook sheet from the active lookbook.'
      )
    );
    return null;
  }
  const sheet = readLookbookSheet(session, sheetId);
  const file = sheet?.asset.files.find((candidate) => candidate.mediaKind === 'image');
  if (!sheet || !file) {
    issues.push(
      issue(
        'PROJECT_DATA413',
        'Selected lookbook sheet has no image file.',
        ['take', 'state', 'structure', 'selectedLookbookSheetIds'],
        'Regenerate or import a lookbook sheet with an image file.'
      )
    );
    return null;
  }
  return {
    kind: 'lookbook-sheet',
    assetId: sheet.asset.assetId,
    assetFileId: file.id,
    role: file.role,
    mediaKind: 'image',
    projectRelativePath: file.projectRelativePath,
    subjectKind: 'lookbook',
    subjectId: context.activeLookbook.id,
  };
}



export function inputsToCreateFromDependencyInventory(
  inventory: MediaGenerationDependencyInventory
): ShotVideoTakePreflightDependency[] {
  return inventory.dependencies
    .filter(
      (line) =>
        line.availability.state === 'missing-generated' ||
        line.availability.state === 'missing-manual'
    )
    .map((line) => {
      const parsed = parseShotVideoInputDependencyId(line.dependencyId);
      const outputInputKind = parsed.ok ? parsed.value.kind : 'reference-image';
      return {
        dependencyId: line.dependencyId,
        dependencyKind: line.dependencyKind,
        ...(line.purpose ? { purpose: line.purpose } : {}),
        outputInputKind,
        ...(parsed.ok && parsed.value.subjectKind
          ? { subjectKind: parsed.value.subjectKind }
          : {}),
        ...(parsed.ok && parsed.value.subjectId
          ? { subjectId: parsed.value.subjectId }
          : {}),
        mediaKind: line.mediaKind as 'image' | 'audio' | 'video',
        required: line.required,
        reason: line.diagnostics[0]?.message ?? line.label,
      };
    });
}
