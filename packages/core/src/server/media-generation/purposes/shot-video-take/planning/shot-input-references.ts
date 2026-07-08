import {
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  MediaGenerationDependencySlot,
  ProjectRelativePath,
  ShotVideoInputReferenceMode,
  ShotVideoTakeInputKind,
  ShotVideoTakeProductionContext,
} from '../../../../../client/index.js';
import {
  readSelectedStoryboardLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../../../../database/access/lookbook.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import {
  resolveMediaGenerationDependencySelection,
} from '../../../dependencies/dependency-selectors.js';
import {
  referenceDependencySlotIncluded,
  validateRequiredReferenceInclusions,
} from './reference-inclusions.js';
import {
  declareShotVideoInputReferenceDependencies,
} from './shot-input-dependencies.js';

export interface ShotVideoInputReferenceBundle {
  inputKind: ShotVideoTakeInputKind;
  referenceMode: ShotVideoInputReferenceMode;
  styleReference: ShotVideoInputResolvedReference | null;
  continuityReferences: ShotVideoInputResolvedReference[];
  promptNotes: string[];
}

export interface ShotVideoInputResolvedReference {
  role:
    | 'movie-lookbook-sheet'
    | 'storyboard-lookbook-sheet'
    | 'location-sheet'
    | 'character-sheet';
  dependencyId: string;
  label: string;
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image';
  required: boolean;
}

export function resolveShotVideoInputReferenceBundle(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  inputKind: ShotVideoTakeInputKind;
  referenceMode: ShotVideoInputReferenceMode;
}): ShotVideoInputReferenceBundle {
  const preflightIssues = validateReferenceModeAvailability(input);
  if (preflightIssues.length > 0) {
    throw new ProjectDataError(
      preflightIssues[0]!.code,
      'Shot video input references are not available for the requested reference mode.',
      {
        issues: preflightIssues,
        suggestion:
          'Select the required Lookbook and generate or import its sheet before preparing this shot input image.',
      }
    );
  }
  const slots = declareShotVideoInputReferenceDependencies(input);
  validateRequiredReferenceInclusions({
    context: input.context,
    slots,
  });
  const activeSlots = slots.filter((slot) =>
    referenceDependencySlotIncluded(input.context, slot)
  );
  const issues: DiagnosticIssue[] = [];
  const references = activeSlots.flatMap((slot) => {
    const result = resolveMediaGenerationDependencySelection({
      session: input.session,
      slot,
    });
    if (result.state === 'satisfied') {
      return [resolvedReferenceFromSlot(input.referenceMode, slot, result.asset)];
    }
    issues.push(referenceIssueForSlot(input.referenceMode, slot, result.diagnostics));
    return [];
  });
  if (issues.length > 0) {
    throw new ProjectDataError(
      issues[0]!.code,
      'Shot video input references could not be resolved.',
      {
        issues,
        suggestion:
          'Select the missing Movie Lookbook, Storyboard Lookbook, Location Sheet, or Character Sheet references before preparing this shot input image.',
      }
    );
  }
  const styleReference =
    references.find(
      (reference) =>
        reference.role === 'movie-lookbook-sheet' ||
        reference.role === 'storyboard-lookbook-sheet'
    ) ?? null;
  const continuityReferences = references.filter(
    (reference) => reference !== styleReference
  );
  return {
    inputKind: input.inputKind,
    referenceMode: input.referenceMode,
    styleReference,
    continuityReferences,
    promptNotes: promptNotesForReferences(input.referenceMode, styleReference),
  };
}

function validateReferenceModeAvailability(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  referenceMode: ShotVideoInputReferenceMode;
}): DiagnosticIssue[] {
  if (input.referenceMode === 'movie-lookbook') {
    if (!input.context.activeLookbook) {
      return [
        createDiagnosticError(
          'CORE_SHOT_VIDEO_INPUT_MOVIE_LOOKBOOK_MISSING',
          'Shot input image generation in movie-lookbook mode requires a selected Movie Lookbook.',
          { path: ['spec', 'referenceMode'] },
          'Create or select a Movie Lookbook before generating shot input images.'
        ),
      ];
    }
    return [];
  }
  const selectedStoryboardLookbookId = readSelectedStoryboardLookbookId(input.session);
  if (!selectedStoryboardLookbookId) {
    return [
      createDiagnosticError(
        'CORE_SHOT_VIDEO_INPUT_STORYBOARD_LOOKBOOK_MISSING',
        'Shot input image generation in storyboard-lookbook mode requires a selected Storyboard Lookbook.',
        { path: ['spec', 'referenceMode'] },
        'Select a Storyboard Lookbook or use referenceMode "movie-lookbook".'
      ),
    ];
  }
  const lookbook = toLookbook(
    requireLookbookRecordById(input.session, selectedStoryboardLookbookId)
  );
  if (lookbook.type !== 'storyboard') {
    return [
      createDiagnosticError(
        'CORE_SHOT_VIDEO_INPUT_STORYBOARD_LOOKBOOK_MISSING',
        `Selected Storyboard Lookbook ${selectedStoryboardLookbookId} is not a Storyboard Lookbook.`,
        { path: ['spec', 'referenceMode'] },
        'Select a Storyboard Lookbook or use referenceMode "movie-lookbook".'
      ),
    ];
  }
  return [];
}

function resolvedReferenceFromSlot(
  referenceMode: ShotVideoInputReferenceMode,
  slot: MediaGenerationDependencySlot,
  asset: {
    assetId: string;
    assetFileId: string;
    projectRelativePath: ProjectRelativePath;
  }
): ShotVideoInputResolvedReference {
  return {
    role: referenceRoleForSlot(referenceMode, slot),
    dependencyId: slot.dependencyId,
    label: slot.label,
    assetId: asset.assetId,
    assetFileId: asset.assetFileId,
    projectRelativePath: asset.projectRelativePath,
    mediaKind: 'image',
    required: slot.required,
  };
}

function referenceRoleForSlot(
  referenceMode: ShotVideoInputReferenceMode,
  slot: MediaGenerationDependencySlot
): ShotVideoInputResolvedReference['role'] {
  if (slot.dependencyKind === 'lookbook-sheet') {
    return referenceMode === 'storyboard-lookbook'
      ? 'storyboard-lookbook-sheet'
      : 'movie-lookbook-sheet';
  }
  if (slot.dependencyKind === 'location-environment-sheet') {
    return 'location-sheet';
  }
  return 'character-sheet';
}

function referenceIssueForSlot(
  referenceMode: ShotVideoInputReferenceMode,
  slot: MediaGenerationDependencySlot,
  diagnostics: DiagnosticIssue[]
): DiagnosticIssue {
  const existing = diagnostics[0];
  if (slot.dependencyKind === 'lookbook-sheet') {
    const code =
      referenceMode === 'storyboard-lookbook'
        ? 'CORE_SHOT_VIDEO_INPUT_STORYBOARD_LOOKBOOK_SHEET_MISSING'
        : 'CORE_SHOT_VIDEO_INPUT_MOVIE_LOOKBOOK_SHEET_MISSING';
    return createDiagnosticError(
      code,
      `${slot.label} is required but no usable image file is available.`,
      { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
      referenceMode === 'storyboard-lookbook'
        ? 'Generate or import a sheet for the selected Storyboard Lookbook.'
        : 'Generate or import a sheet for the selected Movie Lookbook.'
    );
  }
  return createDiagnosticError(
    'CORE_SHOT_VIDEO_INPUT_REFERENCE_FILE_MISSING',
    existing?.message ?? `${slot.label} is required but no usable image file is available.`,
    { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
    existing?.suggestion ?? 'Select or import the required reference image before preparing this shot input image.'
  );
}

function promptNotesForReferences(
  referenceMode: ShotVideoInputReferenceMode,
  styleReference: ShotVideoInputResolvedReference | null
): string[] {
  if (referenceMode === 'storyboard-lookbook') {
    return [
      styleReference
        ? `Use ${styleReference.label} as the primary drawing/style reference.`
        : 'Use the attached Storyboard Lookbook sheet as the primary drawing/style reference.',
      'Use attached Location Sheet and Character Sheet references as content continuity references.',
      'Keep this artifact take-owned; do not turn it into a scene storyboard sheet.',
    ];
  }
  return [
    styleReference
      ? `Use ${styleReference.label} as the primary movie style reference.`
      : 'Use the attached Movie Lookbook sheet as the primary movie style reference.',
    'Use attached Location Sheet and Character Sheet references as continuity references.',
    'Do not render this shot input image in Storyboard Lookbook drawing style.',
  ];
}
