import type {
  ShotVideoTakeInputKind,
  ShotVideoTakeGenerationContext,
  ShotVideoTakePreflightInput,
  ShotVideoTakeAvailableInput,
  ShotVideoTakePreflightDependency,
  ShotVideoTakeGenerationPlan,
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
  selectedLookbookSheetIdsForShots,
} from './reference-selection.js';



export const SHOT_VIDEO_TAKE_INPUT_KIND_LABELS: Record<ShotVideoTakeInputKind, string> = {
  'first-frame': 'First frame',
  'last-frame': 'Last frame',
  'reference-image': 'Reference image',
  'character-sheet': 'Character sheet',
  'location-sheet': 'Location sheet',
  'lookbook-sheet': 'Lookbook sheet',
  'multi-shot-storyboard-sheet': 'Storyboard sheet',
  'source-video': 'Source video',
  audio: 'Audio',
};



export function buildShotVideoTakePreflightInputItems(input: {
  context: ShotVideoTakeGenerationContext;
  preparedInputs: ShotVideoTakePreflightInput[];
  availableInputs: ShotVideoTakeAvailableInput[];
  inputsToCreate: ShotVideoTakePreflightDependency[];
  plan: ShotVideoTakeGenerationPlan;
}): ShotVideoTakePreflightInputItem[] {
  const items: ShotVideoTakePreflightInputItem[] = [];

  const candidatesByDependencyId = new Map<string, ShotVideoTakeAvailableInput[]>();
  input.availableInputs.forEach((availableInput) => {
    const key = shotVideoInputDependencyId({
      kind: availableInput.kind,
      subjectKind: availableInput.subjectKind,
      subjectId: availableInput.subjectId,
    });
    candidatesByDependencyId.set(key, [
      ...(candidatesByDependencyId.get(key) ?? []),
      availableInput,
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
  context: ShotVideoTakeGenerationContext,
  line: MediaGenerationPlanLine
): string {
  const target = dependencyTargetForLine(context, line);
  if (target?.kind === 'castMember') {
    return context.referencedCast.find((castMember) => castMember.id === target.id)?.name ??
      line.label;
  }
  if (target?.kind === 'location') {
    return context.referencedLocations.find((location) => location.id === target.id)?.name ??
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
  context: ShotVideoTakeGenerationContext,
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
  context: ShotVideoTakeGenerationContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[]
): ShotVideoTakePreflightInput[] {
  const inputs: Array<ShotVideoTakePreflightInput | null> = (context.productionGroup.videoTakeProduction.preparedInputs ?? [])
    .map((input) => {
      const available = context.availableInputs.find(
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
            ['productionGroup', 'videoTakeProduction', 'preparedInputs'],
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
    ...lookbookSheetInputsForContext(context, session, issues),
  ];
}



export function lookbookSheetInputsForContext(
  context: ShotVideoTakeGenerationContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[]
): ShotVideoTakePreflightInput[] {
  if (!context.activeLookbook) {
    return [];
  }
  const selectedIds = selectedLookbookSheetIdsForShots(context.shots);
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
  context: ShotVideoTakeGenerationContext,
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
        ['shots', 'shotSpecs', 'lookbookReference', 'lookbookSheetId'],
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
        ['shots', 'shotSpecs', 'lookbookReference', 'lookbookSheetId'],
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
