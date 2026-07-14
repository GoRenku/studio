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
import type { SceneShotListDocument } from '../../client/scene-shot-list.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import { listInspirationFolderRecords } from '../database/access/inspiration-folders.js';
import {
  listLookbookRecords,
  readSelectedMovieLookbookId,
  readSelectedStoryboardLookbookId,
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
  listSceneShotStoryboardImageRecords,
  readActiveSceneShotListRecord,
  readSceneShotListDocument,
} from '../database/access/scene-shot-lists.js';
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
  studioSceneShotListResourceKey,
  studioSceneShotsResourceKey,
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
  const selectedMovieLookbookId = readSelectedMovieLookbookId(session);
  const selectedStoryboardLookbookId = readSelectedStoryboardLookbookId(session);
  return {
    inspirationFolderCount: listInspirationFolderRecords(session, {
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items.length,
    lookbookCount: listLookbookRecords(session).length,
    selectedMovieLookbookId,
    selectedStoryboardLookbookId,
    movieLookbookReadyForGeneration: selectedMovieLookbookId !== null,
    storyboardLookbookReadyForGeneration: selectedStoryboardLookbookId !== null,
  };
}

function readCastReadiness(session: DatabaseSession): DirectorCastReadiness {
  const visualCastMembers = listCastMemberRecords(session).filter(
    (castMember) => !castMember.isVoiceOver
  );
  const missingSelectedVisualReferenceCastMemberIds: string[] = [];
  const missingActiveCastDesignCastMemberIds: string[] = [];
  let selectedVisualReferenceCount = 0;
  let activeCastDesignCount = 0;

  for (const castMember of visualCastMembers) {
    if (readActiveCastDesignId(session, castMember.id)) {
      activeCastDesignCount += 1;
    } else {
      missingActiveCastDesignCastMemberIds.push(castMember.id);
    }
    const selectedAssets = listAssetRelationshipPage(session, {
      target: { kind: 'castMember', castMemberId: castMember.id },
      selection: 'select',
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items.filter(
      (asset) => asset.role === 'character-sheet' || asset.role === 'profile'
    );
    selectedVisualReferenceCount += selectedAssets.length;
    if (selectedAssets.length === 0) {
      missingSelectedVisualReferenceCastMemberIds.push(castMember.id);
    }
  }

  return {
    castMemberCount: visualCastMembers.length,
    activeCastDesignCount,
    missingActiveCastDesignCastMemberIds,
    selectedVisualReferenceCount,
    missingSelectedVisualReferenceCastMemberIds,
    everyCastMemberHasSelectedVisualReference:
      visualCastMembers.length > 0 &&
      missingSelectedVisualReferenceCastMemberIds.length === 0,
  };
}

function readProductionDesignReadiness(
  session: DatabaseSession
): DirectorProductionDesignReadiness {
  const locations = listScreenplayLocationsFromSession(session);
  const missingSelectedEnvironmentSheetLocationIds: string[] = [];
  const missingActiveLocationDesignLocationIds: string[] = [];
  let selectedEnvironmentSheetCount = 0;
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
    const selectedAssets = listAssetRelationshipPage(session, {
      target: { kind: 'location', locationId: location.id },
      selection: 'select',
      role: 'environment_sheet',
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items;
    selectedEnvironmentSheetCount += selectedAssets.length;
    if (selectedAssets.length === 0) {
      missingSelectedEnvironmentSheetLocationIds.push(location.id);
    }
  }

  return {
    locationCount: locations.length,
    activeLocationDesignCount,
    missingActiveLocationDesignLocationIds,
    selectedEnvironmentSheetCount,
    missingSelectedEnvironmentSheetLocationIds,
    everyLocationHasSelectedEnvironmentSheet:
      locations.length > 0 &&
      missingSelectedEnvironmentSheetLocationIds.length === 0,
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

  const activeShotList = readActiveSceneShotListRecord(session, selection.id);
  if (!activeShotList) {
    return {
      sceneId: selection.id,
      shotId: selection.shotId ?? null,
      activeShotListId: null,
      shotCount: 0,
      storyboardStatus: { available: false, missingShotIds: [] },
      shotVideo: {
        generationAvailable: false,
        selectedTakeId: null,
        selectedTakeMode: null,
        selectedShotIds: [],
      },
    };
  }

  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    return null;
  }
  const document = readSceneShotListDocument({
    row: activeShotList,
    screenplay,
  });
  const storyboardImages = listSceneShotStoryboardImageRecords(session, {
    shotListId: activeShotList.id,
  });
  const storyboardShotIds = new Set(storyboardImages.map((image) => image.shotId));
  const missingShotIds = document.shots
    .filter((shot) => !storyboardShotIds.has(shot.shotId))
    .map((shot) => shot.shotId);
  const selectedShotIds = selectedShotIdsForScene(selection, document);

  if (selection.shotId && !selectedShotIds.includes(selection.shotId)) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT009',
        'Selected shot is not in the active Scene Shot List.',
        ['selectedScene', 'shotId'],
        'Select a shot from the active Scene Shot List before generating shot media.'
      )
    );
  }

  const shotVideo = readSelectedShotVideoReadiness({
    selection,
    selectedShotIds,
  });

  return {
    sceneId: selection.id,
    shotId: selection.shotId ?? null,
    activeShotListId: activeShotList.id,
    shotCount: document.shots.length,
    storyboardStatus: {
      available: true,
      missingShotIds,
    },
    shotVideo,
  };
}

function readSelectedShotVideoReadiness(input: {
  selection: Extract<StudioSelection, { type: 'scene' }>;
  selectedShotIds: string[];
}): DirectorSceneReadiness['shotVideo'] {
  const base: DirectorSceneReadiness['shotVideo'] = {
    generationAvailable: input.selectedShotIds.length > 0,
    selectedTakeId: null,
    selectedTakeMode: null,
    selectedShotIds: input.selectedShotIds,
  };
  if (!input.selection.takeId) {
    return base;
  }
  return {
    ...base,
    selectedTakeId: input.selection.takeId,
  };
}

function selectedShotIdsForScene(
  selection: Extract<StudioSelection, { type: 'scene' }>,
  document: SceneShotListDocument
): string[] {
  if (selection.shotId) {
    return document.shots.some((shot) => shot.shotId === selection.shotId)
      ? [selection.shotId]
      : [];
  }
  return document.shots.map((shot) => shot.shotId);
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
  if (!input.visualLanguage.selectedMovieLookbookId) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT004',
        'The current project does not have a selected Movie Lookbook.',
        ['visualLanguage', 'selectedMovieLookbookId'],
        'Create or select a Movie Lookbook before production visual generation.'
      )
    );
  }
  if (!input.visualLanguage.selectedStoryboardLookbookId) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT013',
        'The current project does not have a selected Storyboard Lookbook.',
        ['visualLanguage', 'selectedStoryboardLookbookId'],
        'Create or select a Storyboard Lookbook before storyboard image generation.'
      )
    );
  }
  if (!input.cast.everyCastMemberHasSelectedVisualReference) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT005',
        'One or more cast members do not have selected character-sheet or profile media.',
        ['cast', 'missingSelectedVisualReferenceCastMemberIds'],
        'Generate or select cast character sheets or profiles before relying on cast visuals.'
      )
    );
  }
  if (!input.productionDesign.everyLocationHasSelectedEnvironmentSheet) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT006',
        'One or more locations do not have selected environment-sheet media.',
        ['productionDesign', 'missingSelectedEnvironmentSheetLocationIds'],
        'Generate or select location environment sheets before relying on location visuals.'
      )
    );
  }
  if (input.selectedScene && !input.selectedScene.activeShotListId) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT007',
        'The selected scene does not have an active Scene Shot List.',
        ['selectedScene', 'activeShotListId'],
        'Create a Scene Shot List before generating storyboard images or video takes.'
      )
    );
  }
  if (
    input.selectedScene?.storyboardStatus.available &&
    input.selectedScene.storyboardStatus.missingShotIds.length > 0
  ) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT008',
        'The selected scene is missing one or more storyboard images.',
        ['selectedScene', 'storyboardStatus', 'missingShotIds'],
        'Generate and import storyboard images before final shot-video work.'
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
  if (!input.visualLanguage.selectedMovieLookbookId) {
    steps.push({
      id: 'select-movie-lookbook',
      title: 'Create or select a Movie Lookbook',
      specialistSkill: 'lookbook-designer',
      reason: 'Production visual generation should use an explicit movie visual-language source.',
      command: 'renku lookbook select --type movie --lookbook <lookbook-id> --json',
    });
  }
  if (!input.visualLanguage.selectedStoryboardLookbookId) {
    steps.push({
      id: 'select-storyboard-lookbook',
      title: 'Create or select a Storyboard Lookbook',
      specialistSkill: 'lookbook-designer',
      reason: 'Storyboard image generation should use a dedicated graphic-language source.',
      command:
        'renku lookbook select --type storyboard --lookbook <lookbook-id> --json',
    });
  }
  if (!input.cast.everyCastMemberHasSelectedVisualReference) {
    steps.push({
      id: 'design-cast',
      title: 'Establish cast visuals',
      specialistSkill: 'media-producer',
      reason: 'Cast members need selected character-sheet or profile media for visual continuity.',
      command: 'renku generation context --purpose cast.character-sheet --target cast:<cast-member-id> --json',
    });
  }
  if (!input.productionDesign.everyLocationHasSelectedEnvironmentSheet) {
    steps.push({
      id: 'design-production',
      title: 'Establish location visuals',
      specialistSkill: 'media-producer',
      reason: 'Locations need selected environment sheets before shots rely on location visuals.',
      command: 'renku generation context --purpose location.sheet --target location:<location-id> --json',
    });
  }
  if (input.selectedScene?.shotVideo.selectedTakeId) {
    steps.push({
      id: 'generate-shot-video',
      title: 'Prepare the active shot video take',
      specialistSkill: 'media-producer',
      reason:
        'Studio is focused on an existing Shot Video Take, so generation work should start from its exact Core context.',
      command: `renku generation context --purpose shot.video-take --target take:${input.selectedScene.shotVideo.selectedTakeId} --json`,
    });
  } else if (input.selectedScene && !input.selectedScene.activeShotListId) {
    steps.push({
      id: 'design-shot-list',
      title: 'Design the selected scene shot list',
      specialistSkill: 'scene-shot-designer',
      reason: 'The selected scene needs an active Scene Shot List before storyboard or video work.',
      command: `renku screenplay shot-list context --scene ${input.selectedScene.sceneId} --json`,
    });
  } else if (
    input.selectedScene?.storyboardStatus.available &&
    input.selectedScene.storyboardStatus.missingShotIds.length > 0
  ) {
    steps.push({
      id: 'generate-storyboards',
      title: 'Generate missing storyboard images',
      specialistSkill: 'media-producer',
      reason: 'The active shot list has shots without durable storyboard images.',
      command: `renku generation context --purpose scene.storyboard-sheet --target scene:${input.selectedScene.sceneId} --json`,
    });
  } else if (input.selectedScene?.shotVideo.generationAvailable) {
    steps.push({
      id: 'generate-shot-video',
      title: 'Create or select a shot video take',
      specialistSkill: 'media-producer',
      reason: 'The selected scene has an active shot list; create or select a Take in Studio before authoring its exact generation request.',
      command: null,
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
          studioSceneShotsResourceKey(selectedScene.sceneId),
          ...(selectedScene.activeShotListId
            ? [studioSceneShotListResourceKey(selectedScene.activeShotListId)]
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
