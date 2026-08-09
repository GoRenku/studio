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
import { listAssetPageInSession } from '../assets/projection.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import { listAllInspirationFolderRecords } from '../database/access/inspiration-folders.js';
import {
  listLookbookRecords,
  readLookbookRecordByKind,
} from '../database/access/lookbook.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import {
  readActiveScreenplayAnalysisId,
  listScreenplayAnalysisRecords,
} from '../screenplay-analysis/persistence.js';
import { listLocationRecords } from '../database/access/locations.js';
import {
  readActiveSceneBeatsRevisionRecord,
  readSceneBeats,
} from '../database/access/scene-beats.js';
import {
  readActiveCastDesignId,
} from '../database/access/cast-designs.js';
import {
  readActiveLocationDesignId,
} from '../database/access/location-designs.js';
import { listPropRecords } from '../database/access/props.js';
import { readActivePropDesignId } from '../database/access/prop-designs.js';
import {
  withCurrentProjectSession,
  type CurrentProject,
} from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ReadDirectorContextInput } from '../project-data-service-contracts.js';
import {
  studioCastNavigationResourceKey,
  studioLocationNavigationResourceKey,
  studioPropNavigationResourceKey,
  studioProjectInformationResourceKey,
  studioProjectSettingsResourceKey,
  studioSceneBeatsRevisionResourceKey,
  studioSceneBeatsResourceKey,
  studioScreenplayResourceKey,
  studioVisualLanguageInspirationResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../studio-coordination/resource-keys.js';
import { readStudioSelectionContextProjection } from './selection-context.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { readProjectSettingsFromSession } from '../project-settings/index.js';

export async function readDirectorContext(
  input: ReadDirectorContextInput = {}
): Promise<DirectorContextReport> {
  return await withCurrentProjectSession(input, async ({ currentProject, session }) => {
    const diagnostics: DiagnosticIssue[] = [...(input.studioCurrent?.warnings ?? [])];
    const projectInformation = readProjectInformationResourceFromDatabase(session);
    const projectSettings = readProjectSettingsFromSession(session).settings;
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
      projectSettings,
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
  const screenplay = readCanonicalScreenplay(session);
  const exists = screenplay.opening.length > 0 || screenplay.scenes.length > 0;
  return {
    exists,
    activeAnalysisId: exists ? readActiveScreenplayAnalysisId(session) : null,
    analysisCount:
      exists ? listScreenplayAnalysisRecords({ session }).length : 0,
    counts: {
      castMembers: listCastMemberRecords(session).length,
      locations: listLocationRecords(session).length,
      openingElements: screenplay.opening.length,
      sections: screenplay.sections.length,
      acts: screenplay.sections.filter((section) => section.type === 'act').length,
      sequences: screenplay.sections.filter((section) => section.type === 'sequence').length,
      scenes: screenplay.scenes.length,
      blocks: screenplay.scenes.reduce((count, scene) => count + scene.blocks.length, 0),
      references: screenplay.references.length,
    },
  };
}

function readVisualLanguageReadiness(
  session: DatabaseSession
): DirectorVisualLanguageReadiness {
  const productionLookbookId = readLookbookRecordByKind(session, 'production')?.id ?? null;
  const storyboardLookbookId = readLookbookRecordByKind(session, 'storyboard')?.id ?? null;
  return {
    inspirationFolderCount: listAllInspirationFolderRecords(session).length,
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
    const assets = listAssetPageInSession(session, {
      owner: { kind: 'castMember', id: castMember.id },
      limit: 200,
    }).items.filter(
      (asset) => asset.type === 'character_sheet' || asset.type === 'cast_profile'
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
  const locations = listLocationRecords(session);
  const missingEnvironmentSheetLocationIds: string[] = [];
  const missingActiveLocationDesignLocationIds: string[] = [];
  let locationSheetCount = 0;
  let activeLocationDesignCount = 0;
  const props = listPropRecords(session);
  const missingPropSheetPropIds: string[] = [];
  const missingActivePropDesignPropIds: string[] = [];
  let propSheetCount = 0;
  let activePropDesignCount = 0;

  for (const location of locations) {
    if (readActiveLocationDesignId(session, location.id)) {
      activeLocationDesignCount += 1;
    } else {
      missingActiveLocationDesignLocationIds.push(location.id);
    }
    const assets = listAssetPageInSession(session, {
      owner: { kind: 'location', id: location.id },
      type: 'location_sheet',
      limit: 200,
    }).items;
    locationSheetCount += assets.length;
    if (assets.length === 0) {
      missingEnvironmentSheetLocationIds.push(location.id);
    }
  }

  for (const prop of props) {
    if (readActivePropDesignId(session, prop.id)) {
      activePropDesignCount += 1;
    } else {
      missingActivePropDesignPropIds.push(prop.id);
    }
    const assets = listAssetPageInSession(session, {
      owner: { kind: 'prop', id: prop.id },
      type: 'prop_sheet',
      limit: 200,
    }).items;
    propSheetCount += assets.length;
    if (assets.length === 0) {
      missingPropSheetPropIds.push(prop.id);
    }
  }

  return {
    locationCount: locations.length,
    activeLocationDesignCount,
    missingActiveLocationDesignLocationIds,
    locationSheetCount,
    missingEnvironmentSheetLocationIds,
    everyLocationHasEnvironmentSheet:
      locations.length > 0 &&
      missingEnvironmentSheetLocationIds.length === 0,
    propCount: props.length,
    activePropDesignCount,
    missingActivePropDesignPropIds,
    propSheetCount,
    missingPropSheetPropIds,
    everyPropHasPropSheet:
      props.length === 0 || missingPropSheetPropIds.length === 0,
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

  const activeRevision = readActiveSceneBeatsRevisionRecord(session, selection.id);
  if (!activeRevision) {
    return {
      sceneId: selection.id,
      beatId: selection.beatId ?? null,
      activeRevisionId: null,
      beatCount: 0,
      storyboardStatus: { available: false, missingBeatIds: [] },
    };
  }

  const document = readSceneBeats({
    row: activeRevision,
  });
  const missingBeatIds = document.beats
    .filter((beat) =>
      listAssetPageInSession(session, {
        owner: {
          kind: 'sceneBeat',
          sceneId: selection.id,
          beatId: beat.id,
        },
        type: 'scene_storyboard_image',
        limit: 1,
      }).items.length === 0
    )
    .map((beat) => beat.id);

  if (
    selection.beatId &&
    !document.beats.some((beat) => beat.id === selection.beatId)
  ) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT009',
        'Selected Beat is not in the active Scene Beats revision.',
        ['selectedScene', 'beatId'],
        'Select a Beat from the active Scene Beats revision.'
      )
    );
  }

  return {
    sceneId: selection.id,
    beatId: selection.beatId ?? null,
    activeRevisionId: activeRevision.id,
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
        'One or more locations do not have Location Sheet media.',
        ['productionDesign', 'missingEnvironmentSheetLocationIds'],
        'Generate or select Location Sheets before relying on location visuals.'
      )
    );
  }
  if (!input.productionDesign.everyPropHasPropSheet) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT014',
        'One or more Props do not have Prop Sheet media.',
        ['productionDesign', 'missingPropSheetPropIds'],
        'Generate or select Prop Sheets before relying on Prop visuals.'
      )
    );
  }
  if (input.selectedScene && !input.selectedScene.activeRevisionId) {
    diagnostics.push(
      directorWarning(
        'DIRECTOR_CONTEXT007',
        'The selected scene does not have an active Scene Beats revision.',
        ['selectedScene', 'activeRevisionId'],
        'Create a Scene Beats revision before generating storyboard images.'
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
      title: 'Establish production-design visuals',
      specialistSkill: 'media-producer',
      reason: 'Locations need available Location Sheet media before shots rely on their visuals.',
      command: 'renku generation context --purpose location.sheet --target location:<location-id> --json',
    });
  }
  if (!input.productionDesign.everyPropHasPropSheet) {
    steps.push({
      id: 'design-props',
      title: 'Establish Prop visuals',
      specialistSkill: 'media-producer',
      reason: 'Authored Props need available Prop Sheet media before shots rely on their visuals.',
      command: 'renku generation context --purpose prop.sheet --target prop:<prop-id> --json',
    });
  }
  if (input.selectedScene && !input.selectedScene.activeRevisionId) {
    steps.push({
      id: 'design-scene-beats',
      title: 'Design the selected Scene Beats revision',
      specialistSkill: 'scene-beat-designer',
      reason: 'The selected Scene needs an active Scene Beats revision before storyboard work.',
      command: `renku screenplay beats context --scene ${input.selectedScene.sceneId} --json`,
    });
  } else if (
    input.selectedScene?.storyboardStatus.available &&
    input.selectedScene.storyboardStatus.missingBeatIds.length > 0
  ) {
    steps.push({
      id: 'generate-storyboards',
      title: 'Generate missing storyboard images',
      specialistSkill: 'media-producer',
      reason: 'The active Scene Beats revision has Beats without durable storyboard images.',
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
    studioProjectSettingsResourceKey(),
    studioScreenplayResourceKey(),
    'screenplay-analysis',
    studioVisualLanguageInspirationResourceKey(),
    studioVisualLanguageLookbooksResourceKey(),
    studioCastNavigationResourceKey(),
    studioLocationNavigationResourceKey(),
    studioPropNavigationResourceKey(),
    ...(selectedScene
      ? [
          studioSceneBeatsResourceKey(selectedScene.sceneId),
          ...(selectedScene.activeRevisionId
            ? [studioSceneBeatsRevisionResourceKey(selectedScene.activeRevisionId)]
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
