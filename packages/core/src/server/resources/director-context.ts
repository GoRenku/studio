import {
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  DirectorCastReadiness,
  DirectorContextReport,
  DirectorNextStep,
  DirectorProductionDesignReadiness,
  DirectorSceneReadiness,
  DirectorScreenplayReadiness,
  DirectorVisualLanguageReadiness,
  StudioSelection,
  StudioSelectionContextResult,
} from '../../client/index.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import { listInspirationFolderRecords } from '../database/access/inspiration-folders.js';
import {
  listLookbookRecords,
  readLookbookRecordByKind,
} from '../database/access/lookbook.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import {
  readActiveScreenplayAnalysisId,
  listScreenplayAnalysisRecords,
} from '../database/access/screenplay-analysis.js';
import {
  hasScreenplayRecord,
  readScreenplayStatusCounts,
} from '../database/access/screenplay-status.js';
import {
  listScreenplayLocationsFromSession,
  readScreenplayDocumentFromSession,
} from '../database/access/screenplay-resource.js';
import {
  readActiveSceneBeatSheetRecord,
  readSceneBeatSheetDocument,
} from '../database/access/scene-beat-sheets.js';
import {
  listSceneBeatStoryboardImageRecords,
} from '../database/access/scene-beat-storyboard-images.js';
import {
  readActiveCastDesignId,
  readActiveLocationDesignId,
} from '../database/access/department-design.js';
import {
  withCurrentProjectSession,
  type CurrentProject,
} from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ReadDirectorContextInput } from '../project-data-service-contracts.js';
import {
  studioCastNavigationResourceKey,
  studioLocationNavigationResourceKey,
  studioProjectInformationResourceKey,
  studioSceneBeatSheetResourceKey,
  studioSceneBeatsResourceKey,
  studioScreenplayResourceKey,
  studioVisualLanguageInspirationResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../studio-coordination/resource-keys.js';
import { readStudioSelectionContextProjection } from './selection-context.js';

export async function readDirectorContext(
  input: ReadDirectorContextInput = {}
): Promise<DirectorContextReport> {
  return await withCurrentProjectSession(input, async ({ currentProject, session }) => {
    const diagnostics: DiagnosticIssue[] = [...(input.studioCurrent?.warnings ?? [])];
    const projectInformation = readProjectInformationResourceFromDatabase(session);
    const screenplay = readScreenplayReadiness(session);
    const visualLanguage = readVisualLanguageReadiness(session);
    const cast = readCastReadiness(session);
    const productionDesign = readProductionDesignReadiness(session);
    const currentSelection = readDirectorSelection({
      session,
      currentProject,
      selection: input.selection,
      studioCurrent: input.studioCurrent,
      diagnostics,
    });
    const selectedScene = currentSelection?.valid
      ? await readSelectedSceneReadiness({
          session,
          selection: currentSelection.selection,
          currentProject,
          homeDir: input.homeDir,
          diagnostics,
        })
      : null;

    diagnostics.push(
      ...readinessDiagnostics({
        screenplay,
        visualLanguage,
        cast,
        productionDesign,
        selectedScene,
      })
    );

    const nextSteps = buildNextSteps({
      screenplay,
      visualLanguage,
      cast,
      productionDesign,
      selectedScene,
    });

    return {
      valid: true,
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        title: projectInformation.title,
        aspectRatio: projectInformation.aspectRatio,
      },
      currentSelection,
      screenplay,
      visualLanguage,
      cast,
      productionDesign,
      selectedScene,
      agentMedia: {
        imageGeneration: {
          defaultExecutionPath: 'ask',
          appliesToPurpose: false,
          renkuManagedAvailable: false,
          externalBuiltInGeneration: {
            preferred: null,
            availableInRenku: false,
            requiresHarnessTool: true,
          },
        },
      },
      nextSteps,
      resourceKeys: directorResourceKeys(currentSelection, selectedScene),
      diagnostics,
      warnings: diagnostics.filter((issue) => issue.severity === 'warning'),
    };
  });
}

function readScreenplayReadiness(
  session: DatabaseSession
): DirectorScreenplayReadiness {
  const exists = hasScreenplayRecord(session);
  const screenplay = readScreenplayDocumentFromSession(session);
  return {
    exists,
    activeAnalysisId: exists ? readActiveScreenplayAnalysisId(session) : null,
    analysisCount:
      exists && screenplay
        ? listScreenplayAnalysisRecords({ session, screenplay }).length
        : 0,
    counts: readScreenplayStatusCounts(session),
  };
}

function readVisualLanguageReadiness(
  session: DatabaseSession
): DirectorVisualLanguageReadiness {
  const productionLookbookId = readLookbookRecordByKind(session, 'production')?.id ?? null;
  const storyboardLookbookId = readLookbookRecordByKind(session, 'storyboard')?.id ?? null;
  return {
    inspirationFolderCount: listInspirationFolderRecords(session, {
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items.length,
    lookbookCount: listLookbookRecords(session).length,
    productionLookbookId,
    storyboardLookbookId,
    productionLookbookReadyForGeneration: productionLookbookId !== null,
    storyboardLookbookReadyForGeneration: storyboardLookbookId !== null,
  };
}

function readCastReadiness(session: DatabaseSession): DirectorCastReadiness {
  const visualCastMembers = listCastMemberRecords(session).filter(
    (castMember) => !castMember.isVoiceOver
  );
  const missingVisualReferenceCastMemberIds: string[] = [];
  const missingActiveCastDesignCastMemberIds: string[] = [];
  let visualReferenceCount = 0;
  let activeCastDesignCount = 0;

  for (const castMember of visualCastMembers) {
    if (readActiveCastDesignId(session, castMember.id)) {
      activeCastDesignCount += 1;
    } else {
      missingActiveCastDesignCastMemberIds.push(castMember.id);
    }
    const assets = listAssetRelationshipPage(session, {
      target: { kind: 'castMember', castMemberId: castMember.id },
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items.filter(
      (asset) => asset.role === 'character-sheet' || asset.role === 'profile'
    );
    visualReferenceCount += assets.length;
    if (assets.length === 0) {
      missingVisualReferenceCastMemberIds.push(castMember.id);
    }
  }

  return {
    castMemberCount: visualCastMembers.length,
    activeCastDesignCount,
    missingActiveCastDesignCastMemberIds,
    visualReferenceCount,
    missingVisualReferenceCastMemberIds,
    everyCastMemberHasVisualReference:
      visualCastMembers.length > 0 &&
      missingVisualReferenceCastMemberIds.length === 0,
  };
}

function readProductionDesignReadiness(
  session: DatabaseSession
): DirectorProductionDesignReadiness {
  const locations = listScreenplayLocationsFromSession(session);
  const missingEnvironmentSheetLocationIds: string[] = [];
  const missingActiveLocationDesignLocationIds: string[] = [];
  let environmentSheetCount = 0;
  let activeLocationDesignCount = 0;

  for (const location of locations) {
    if (!location.id) {
      continue;
    }
    if (readActiveLocationDesignId(session, location.id)) {
      activeLocationDesignCount += 1;
    } else {
      missingActiveLocationDesignLocationIds.push(location.id);
    }
    const assets = listAssetRelationshipPage(session, {
      target: { kind: 'location', locationId: location.id },
      role: 'environment_sheet',
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items;
    environmentSheetCount += assets.length;
    if (assets.length === 0) {
      missingEnvironmentSheetLocationIds.push(location.id);
    }
  }

  return {
    locationCount: locations.length,
    activeLocationDesignCount,
    missingActiveLocationDesignLocationIds,
    environmentSheetCount,
    missingEnvironmentSheetLocationIds,
    everyLocationHasEnvironmentSheet:
      locations.length > 0 &&
      missingEnvironmentSheetLocationIds.length === 0,
  };
}

function readDirectorSelection(input: {
  session: DatabaseSession;
  currentProject: CurrentProject;
  selection?: StudioSelection;
  studioCurrent?: ReadDirectorContextInput['studioCurrent'];
  diagnostics: DiagnosticIssue[];
}): StudioSelectionContextResult | null {
  const selection = input.selection ?? selectionFromStudioCurrent(input);
  if (!selection) {
    return null;
  }
  const result = readStudioSelectionContextProjection(input.session, {
    selection,
  });
  if (!result.valid) {
    input.diagnostics.push(...result.diagnostics);
  }
  return result;
}

function selectionFromStudioCurrent(input: {
  currentProject: CurrentProject;
  studioCurrent?: ReadDirectorContextInput['studioCurrent'];
  diagnostics: DiagnosticIssue[];
}): StudioSelection | null {
  const current = input.studioCurrent;
  if (!current?.selection || !current.project) {
    return null;
  }
  if (
    current.project.id !== input.currentProject.projectId ||
    current.project.name !== input.currentProject.projectName
  ) {
    input.diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT001',
        'Current Studio focus belongs to a different project than the open authoring project.',
        ['currentSelection'],
        'Open or select the same project in Studio before acting on the focused item.'
      )
    );
    return null;
  }
  return current.selection;
}

async function readSelectedSceneReadiness(input: {
  session: DatabaseSession;
  selection: StudioSelection;
  currentProject: CurrentProject;
  homeDir?: string;
  diagnostics: DiagnosticIssue[];
}): Promise<DirectorSceneReadiness | null> {
  const { session, selection, diagnostics } = input;
  if (selection.type !== 'scene') {
    return null;
  }

  const activeBeatSheet = readActiveSceneBeatSheetRecord(session, selection.id);
  if (!activeBeatSheet) {
    return {
      sceneId: selection.id,
      beatId: selection.beatId ?? null,
      activeBeatSheetId: null,
      beatCount: 0,
      storyboardStatus: { available: false, missingBeatIds: [] },
    };
  }

  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    return null;
  }
  const document = readSceneBeatSheetDocument({
    row: activeBeatSheet,
    screenplay,
  });
  const storyboardImages = listSceneBeatStoryboardImageRecords(session, {
    beatSheetId: activeBeatSheet.id,
  });
  const storyboardBeatIds = new Set(storyboardImages.map((image) => image.beatId));
  const missingBeatIds = document.beats
    .filter((beat) => !storyboardBeatIds.has(beat.id))
    .map((beat) => beat.id);

  if (
    selection.beatId &&
    !document.beats.some((beat) => beat.id === selection.beatId)
  ) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT009',
        'Selected Beat is not in the active Scene Beat Sheet.',
        ['selectedScene', 'beatId'],
        'Select a Beat from the active Scene Beat Sheet.'
      )
    );
  }

  return {
    sceneId: selection.id,
    beatId: selection.beatId ?? null,
    activeBeatSheetId: activeBeatSheet.id,
    beatCount: document.beats.length,
    storyboardStatus: {
      available: true,
      missingBeatIds,
    },
  };
}

function readinessDiagnostics(input: {
  screenplay: DirectorScreenplayReadiness;
  visualLanguage: DirectorVisualLanguageReadiness;
  cast: DirectorCastReadiness;
  productionDesign: DirectorProductionDesignReadiness;
  selectedScene: DirectorSceneReadiness | null;
}): DiagnosticIssue[] {
  const diagnostics: DiagnosticIssue[] = [];
  if (!input.screenplay.exists) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT002',
        'The current project does not have screenplay data yet.',
        ['screenplay'],
        'Draft or import the screenplay before designing departments or generating media.'
      )
    );
    return diagnostics;
  }
  if (!input.screenplay.activeAnalysisId) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT003',
        'The current project does not have an active Screenplay Analysis.',
        ['screenplay', 'activeAnalysisId'],
        'Run screenplay analysis before using critique as production guidance.'
      )
    );
  }
  if (!input.visualLanguage.productionLookbookId) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT004',
        'The current project does not have a Production Lookbook.',
        ['visualLanguage', 'productionLookbookId'],
        'Create the Production Lookbook before production visual generation.'
      )
    );
  }
  if (!input.visualLanguage.storyboardLookbookId) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT013',
        'The current project does not have a Storyboard Lookbook.',
        ['visualLanguage', 'storyboardLookbookId'],
        'Create the Storyboard Lookbook before storyboard image generation.'
      )
    );
  }
  if (!input.cast.everyCastMemberHasVisualReference) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT005',
        'One or more cast members do not have character-sheet or profile media.',
        ['cast', 'missingVisualReferenceCastMemberIds'],
        'Generate or select cast character sheets or profiles before relying on cast visuals.'
      )
    );
  }
  if (!input.productionDesign.everyLocationHasEnvironmentSheet) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT006',
        'One or more locations do not have environment-sheet media.',
        ['productionDesign', 'missingEnvironmentSheetLocationIds'],
        'Generate or select location environment sheets before relying on location visuals.'
      )
    );
  }
  if (input.selectedScene && !input.selectedScene.activeBeatSheetId) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT007',
        'The selected scene does not have an active Scene Beat Sheet.',
        ['selectedScene', 'activeBeatSheetId'],
        'Create a Scene Beat Sheet before generating storyboard images.'
      )
    );
  }
  if (
    input.selectedScene?.storyboardStatus.available &&
    input.selectedScene.storyboardStatus.missingBeatIds.length > 0
  ) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT008',
        'The selected scene is missing one or more storyboard images.',
        ['selectedScene', 'storyboardStatus', 'missingBeatIds'],
        'Generate and import storyboard images for the missing Beats.'
      )
    );
  }
  return diagnostics;
}

function buildNextSteps(input: {
  screenplay: DirectorScreenplayReadiness;
  visualLanguage: DirectorVisualLanguageReadiness;
  cast: DirectorCastReadiness;
  productionDesign: DirectorProductionDesignReadiness;
  selectedScene: DirectorSceneReadiness | null;
}): DirectorNextStep[] {
  const steps: DirectorNextStep[] = [];
  if (!input.screenplay.exists) {
    steps.push({
      id: 'draft-screenplay',
      title: 'Draft the screenplay',
      specialistSkill: 'screenplay-drafter',
      reason: 'The project needs screenplay data before department work can be grounded.',
      command: 'renku screenplay create --file <screenplay-json> --json',
    });
    return steps;
  }
  if (!input.screenplay.activeAnalysisId) {
    steps.push({
      id: 'analyze-screenplay',
      title: 'Analyze the screenplay',
      specialistSkill: 'screenplay-analyst',
      reason: 'An active analysis gives the director workflow critique and revision guidance.',
      command: 'renku screenplay analyze context --json',
    });
  }
  if (!input.visualLanguage.productionLookbookId) {
    steps.push({
      id: 'author-production-lookbook',
      title: 'Create the Production Lookbook',
      specialistSkill: 'lookbook-designer',
      reason: 'Production visual generation should use the project Production Lookbook.',
      command: 'renku lookbook apply --file <production-lookbook-json> --json',
    });
  }
  if (!input.visualLanguage.storyboardLookbookId) {
    steps.push({
      id: 'author-storyboard-lookbook',
      title: 'Create the Storyboard Lookbook',
      specialistSkill: 'lookbook-designer',
      reason: 'Storyboard image generation should use a dedicated graphic-language source.',
      command: 'renku lookbook apply --file <storyboard-lookbook-json> --json',
    });
  }
  if (!input.cast.everyCastMemberHasVisualReference) {
    steps.push({
      id: 'design-cast',
      title: 'Establish cast visuals',
      specialistSkill: 'media-producer',
      reason: 'Cast members need available character-sheet or profile media for visual continuity.',
      command: 'renku generation context --purpose cast.character-sheet --target cast:<cast-member-id> --json',
    });
  }
  if (!input.productionDesign.everyLocationHasEnvironmentSheet) {
    steps.push({
      id: 'design-production',
      title: 'Establish location visuals',
      specialistSkill: 'media-producer',
      reason: 'Locations need available environment sheets before shots rely on location visuals.',
      command: 'renku generation context --purpose location.sheet --target location:<location-id> --json',
    });
  }
  if (input.selectedScene && !input.selectedScene.activeBeatSheetId) {
    steps.push({
      id: 'design-beat-sheet',
      title: 'Design the selected Scene Beat Sheet',
      specialistSkill: 'scene-beat-designer',
      reason: 'The selected Scene needs an active Scene Beat Sheet before storyboard work.',
      command: `renku screenplay beat-sheet context --scene ${input.selectedScene.sceneId} --json`,
    });
  } else if (
    input.selectedScene?.storyboardStatus.available &&
    input.selectedScene.storyboardStatus.missingBeatIds.length > 0
  ) {
    steps.push({
      id: 'generate-storyboards',
      title: 'Generate missing storyboard images',
      specialistSkill: 'media-producer',
      reason: 'The active Beat Sheet has Beats without durable storyboard images.',
      command: `renku generation context --purpose scene.storyboard-sheet --target scene:${input.selectedScene.sceneId} --json`,
    });
  }
  return steps;
}

function directorResourceKeys(
  currentSelection: StudioSelectionContextResult | null,
  selectedScene: DirectorSceneReadiness | null
): string[] {
  return [
    studioProjectInformationResourceKey(),
    studioScreenplayResourceKey(),
    'screenplay-analysis',
    studioVisualLanguageInspirationResourceKey(),
    studioVisualLanguageLookbooksResourceKey(),
    studioCastNavigationResourceKey(),
    studioLocationNavigationResourceKey(),
    ...(selectedScene
      ? [
          studioSceneBeatsResourceKey(selectedScene.sceneId),
          ...(selectedScene.activeBeatSheetId
            ? [studioSceneBeatSheetResourceKey(selectedScene.activeBeatSheetId)]
            : []),
        ]
      : []),
    ...(currentSelection?.valid ? currentSelection.resourceKeys : []),
  ].filter(unique);
}

function unique(value: string, index: number, values: string[]): boolean {
  return values.indexOf(value) === index;
}

function directorWarning(
  code: string,
  message: string,
  path: string[],
  suggestion: string
): DiagnosticIssue {
  return createDiagnosticWarning(
    code,
    message,
    { path, context: 'director context' },
    suggestion
  );
}
