import type {
  ActStoryboardResource,
  ActStoryboardScene,
  ActStoryboardSequence,
  ActStoryboardShot,
  Asset,
  LocationAzimuthViewId,
  SceneShotListResource,
  ScreenplayImageReference,
  SequenceSceneStoryboardPreview,
} from '../../client/index.js';
import type {
  SceneShot,
  SceneShotListDocument,
  ShotSpecs,
} from '../../client/scene-shot-list.js';
import type { ScreenplayDocument } from '../../client/screenplay.js';
import { deriveShotSpecPromptStrings } from '../../client/shot-spec-labels.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  listAssetRelationshipPage,
  readAssetRelationship,
  readAssetRelationshipRecord,
} from '../database/access/asset-relationships/index.js';
import {
  listSceneNavigationPage,
  listSequenceNavigationPage,
  readActNavigationRow,
  readSceneNavigationContext,
} from '../database/access/navigation.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  listSceneShotStoryboardImageRecords,
  readActiveSceneShotListRecord,
  readSceneShotListDocument,
  updateSceneShotListRecordDocument,
} from '../database/access/scene-shot-lists.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { readLocationRecord } from '../database/access/locations.js';
import { readLookbookSheet } from '../database/access/lookbook-sheets.js';
import {
  listLocationEnvironmentSheetViews,
  readLocationEnvironmentSheetByAssetId,
} from '../database/access/location-environment-sheets.js';
import { requireShotVideoTakeInput } from '../database/access/shot-video-takes.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  ReadActStoryboardResourceInput,
  ReadSceneShotListResourceInput,
  UpdateSceneShotCastCharacterSheetReferenceInput,
  UpdateSceneShotCastReferencesInput,
  UpdateSceneShotCustomReferenceImagesInput,
  UpdateSceneShotLocationSheetReferenceInput,
  UpdateSceneShotLocationReferenceInput,
  UpdateSceneShotLocationViewReferencesInput,
  UpdateSceneShotLookbookReferenceInput,
  UpdateSceneShotGroupReferenceInclusionInput,
  UpdateSceneShotReferenceInclusionInput,
  UpdateSceneShotSpecsInput,
} from '../project-data-service-contracts.js';

export async function readSceneShotListResource(
  input: ReadSceneShotListResourceInput
): Promise<SceneShotListResource> {
  const { session } = await openProjectSession(input);
  try {
    const context = readSceneNavigationContext(session, input.sceneId);
    if (!context) {
      throwNotFound('scene', input.sceneId);
    }
    const act = readActNavigationRow(session, context.sequence.actId);
    if (!act) {
      throwNotFound('act', context.sequence.actId);
    }
    const projection = readSceneStoryboardProjection(session, input.sceneId);
    const screenplay = requireScreenplayDocumentFromSession(session);
    return {
      scene: context.scene,
      sequence: context.sequence,
      act,
      projectAspectRatio: readProjectRecord(session)?.aspectRatio ?? null,
      activeShotListId:
        readActiveSceneShotListRecord(session, input.sceneId)?.id ?? null,
      activeShotList: projection.document,
      storyboardImagesByShotId: projection.imagesByShotId,
      castMemberLabels: screenplay
        ? Object.fromEntries(
            screenplay.cast.map((castMember) => [castMember.id, castMember.name])
          )
        : {},
      castMemberImages: screenplay
        ? Object.fromEntries(
            screenplay.cast.flatMap((castMember) => {
              if (!castMember.id) {
                return [];
              }
              const image = firstCastMemberImage(session, castMember.id);
              return image ? [[castMember.id, image]] : [];
            })
          )
        : {},
      locationLabels: screenplay
        ? Object.fromEntries(
            screenplay.locations.map((location) => [location.id, location.name])
          )
        : {},
    };
  } finally {
    session.close();
  }
}

function firstCastMemberImage(
  session: DatabaseSession,
  castMemberId: string
): ScreenplayImageReference | undefined {
  const target = { kind: 'castMember' as const, castMemberId };
  const asset =
    listAssetRelationshipPage(session, {
      target,
      role: 'profile',
      mediaKind: 'image',
      selection: 'select',
      limit: 1,
    }).items[0] ??
    listAssetRelationshipPage(session, {
      target,
      role: 'profile',
      mediaKind: 'image',
      selection: 'take',
      limit: 1,
    }).items[0] ??
    listAssetRelationshipPage(session, {
      target,
      role: 'character_sheet',
      mediaKind: 'image',
      selection: 'select',
      limit: 1,
    }).items[0] ??
    listAssetRelationshipPage(session, {
      target,
      mediaKind: 'image',
      selection: 'select',
      limit: 1,
    }).items[0] ??
    listAssetRelationshipPage(session, {
      target,
      mediaKind: 'image',
      selection: 'take',
      limit: 1,
    }).items[0];
  return asset ? toScreenplayImageReference(asset) : undefined;
}

function toScreenplayImageReference(
  asset: Asset
): ScreenplayImageReference | undefined {
  const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
  if (!file) {
    return undefined;
  }
  return {
    assetId: asset.assetId,
    relationshipId: asset.relationshipId,
    assetFileId: file.id,
    title: asset.title,
    fileRole: file.role,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
  };
}

/**
 * In-place update of a single shot's structured shot specs on the scene's
 * active shot list (0036). Re-derives the prompt-facing free-text strings,
 * revalidates the whole document, and writes it back without creating a new
 * history row. Returns the refreshed shot-list resource for the active surface.
 */
export async function updateSceneShotSpecs(
  input: UpdateSceneShotSpecsInput
): Promise<SceneShotListResource> {
  const { session } = await openProjectSession(input);
  try {
    const shotListRow = readActiveSceneShotListRecord(session, input.sceneId);
    if (!shotListRow) {
      throw new ProjectDataError(
        'PROJECT_DATA329',
        `Scene has no active shot list to update: ${input.sceneId}.`,
        {
          suggestion:
            'Create or activate a shot list for this scene before editing shot specs.',
        }
      );
    }
    const screenplay = requireScreenplayDocument(session);
    const document = readSceneShotListDocument({
      row: shotListRow,
      screenplay,
    });
    const shot = document.shots.find((entry) => entry.shotId === input.shotId);
    if (!shot) {
      throw new ProjectDataError(
        'PROJECT_DATA330',
        `Shot was not found in the active shot list: ${input.shotId}.`,
        { suggestion: 'Use a shot id from the active shot list.' }
      );
    }
    applyShotSpecs(shot, input.shotSpecs);
    const now = new Date().toISOString();
    updateSceneShotListRecordDocument({
      session,
      id: shotListRow.id,
      document,
      screenplay,
      now,
    });
  } finally {
    session.close();
  }
  return readSceneShotListResource({
    projectName: input.projectName,
    sceneId: input.sceneId,
    homeDir: input.homeDir,
  });
}

export async function updateSceneShotCastReferences(
  input: UpdateSceneShotCastReferencesInput
): Promise<SceneShotListResource> {
  await updateActiveShotSpecs(input, (session, shot, screenplay) => {
    const sceneCastMemberIds = sceneNarrativeCastMemberIds(screenplay, input.sceneId);
    for (const castMemberId of input.castMemberIds) {
      if (!readCastMemberRecord(session, castMemberId)) {
        throw new ProjectDataError(
          'CORE_SHOT_REFERENCE_UNKNOWN_CAST_MEMBER',
          `Cast member was not found: ${castMemberId}.`,
          { suggestion: 'Choose a cast member from the current project.' }
        );
      }
      if (!sceneCastMemberIds.has(castMemberId)) {
        throw new ProjectDataError(
          'CORE_SHOT_REFERENCE_CAST_OUTSIDE_NARRATIVE',
          `Cast member is not available in this scene narrative: ${castMemberId}.`,
          { suggestion: 'Add the cast member to the scene narrative before selecting them for this shot.' }
        );
      }
    }
    const next = { ...(shot.shotSpecs ?? {}) };
    next.castReferences = {
      ...(next.castReferences ?? {}),
      castMemberIds: [...new Set(input.castMemberIds)],
    };
    applyShotSpecs(shot, next);
  });
  return readSceneShotListResource(input);
}

export async function updateSceneShotLocationReference(
  input: UpdateSceneShotLocationReferenceInput
): Promise<SceneShotListResource> {
  await updateActiveShotSpecs(input, (session, shot, screenplay) => {
    validateSceneLocationReference(session, screenplay, input.sceneId, input.locationId);
    const next = { ...(shot.shotSpecs ?? {}) };
    next.location = {
      locationId: input.locationId,
      ...(input.environmentSheetAssetId
        ? { environmentSheetAssetId: input.environmentSheetAssetId }
        : {}),
      ...(input.viewIds?.length ? { viewIds: [...new Set(input.viewIds)] } : {}),
    };
    applyShotSpecs(shot, next);
  });
  return readSceneShotListResource(input);
}

export async function updateSceneShotCastCharacterSheetReference(
  input: UpdateSceneShotCastCharacterSheetReferenceInput
): Promise<SceneShotListResource> {
  await updateActiveShotSpecs(input, (session, shot, screenplay) => {
    const sceneCastMemberIds = sceneNarrativeCastMemberIds(screenplay, input.sceneId);
    if (!sceneCastMemberIds.has(input.castMemberId)) {
      throw new ProjectDataError(
        'CORE_SHOT_REFERENCE_CAST_OUTSIDE_NARRATIVE',
        `Cast member is not available in this scene narrative: ${input.castMemberId}.`,
        { suggestion: 'Add the cast member to the scene narrative before selecting a character sheet.' }
      );
    }
    if (input.assetId) {
      const relationship = readAssetRelationshipRecord(session, {
        target: { kind: 'castMember', castMemberId: input.castMemberId },
        assetId: input.assetId,
      });
      if (!relationship || relationship.role !== 'character_sheet') {
        throw new ProjectDataError(
          'CORE_SHOT_REFERENCE_UNKNOWN_INPUT',
          `Character sheet asset does not belong to cast member ${input.castMemberId}: ${input.assetId}.`,
          { suggestion: 'Choose a character sheet asset for the selected cast member.' }
        );
      }
    }
    const next = { ...(shot.shotSpecs ?? {}) };
    const characterSheetAssetIds = {
      ...(next.castReferences?.characterSheetAssetIds ?? {}),
    };
    if (input.assetId) {
      characterSheetAssetIds[input.castMemberId] = input.assetId;
    } else {
      delete characterSheetAssetIds[input.castMemberId];
    }
    next.castReferences = {
      ...(next.castReferences ?? {}),
      characterSheetAssetIds,
    };
    applyShotSpecs(shot, next);
  });
  return readSceneShotListResource(input);
}

export async function updateSceneShotLocationSheetReference(
  input: UpdateSceneShotLocationSheetReferenceInput
): Promise<SceneShotListResource> {
  await updateActiveShotSpecs(input, (session, shot, screenplay) => {
    validateSceneLocationReference(session, screenplay, input.sceneId, input.locationId);
    if (input.assetId) {
      validateLocationSheetAsset(session, input.locationId, input.assetId);
    }
    const next = { ...(shot.shotSpecs ?? {}) };
    next.location = {
      ...(next.location ?? {}),
      locationId: input.locationId,
      ...(input.assetId ? { environmentSheetAssetId: input.assetId } : {}),
    };
    if (!input.assetId) {
      delete next.location.environmentSheetAssetId;
    }
    applyShotSpecs(shot, next);
  });
  return readSceneShotListResource(input);
}

export async function updateSceneShotLocationViewReferences(
  input: UpdateSceneShotLocationViewReferencesInput
): Promise<SceneShotListResource> {
  await updateActiveShotSpecs(input, (session, shot, screenplay) => {
    validateSceneLocationReference(session, screenplay, input.sceneId, input.locationId, {
      shot,
    });
    validateLocationSheetAsset(session, input.locationId, input.assetId);
    const sheet = readLocationEnvironmentSheetByAssetId(session, input.assetId);
    const availableViews = new Set(
      sheet
        ? listLocationEnvironmentSheetViews(session, sheet.id).map((view) =>
            locationAzimuthViewId(view.azimuthDegrees as 0 | 90 | 180 | 270)
          )
        : []
    );
    for (const viewId of input.viewIds) {
      if (!availableViews.has(viewId)) {
        throw new ProjectDataError(
          'CORE_SHOT_REFERENCE_UNKNOWN_INPUT',
          `Location view is not available on the selected sheet: ${viewId}.`,
          { suggestion: 'Choose views from the selected location sheet.' }
        );
      }
    }
    const next = { ...(shot.shotSpecs ?? {}) };
    next.location = {
      ...(next.location ?? {}),
      locationId: input.locationId,
      environmentSheetAssetId: input.assetId,
      viewIds: [...new Set(input.viewIds)],
    };
    applyShotSpecs(shot, next);
  });
  return readSceneShotListResource(input);
}

export async function updateSceneShotLookbookReference(
  input: UpdateSceneShotLookbookReferenceInput
): Promise<SceneShotListResource> {
  await updateActiveShotSpecs(input, (session, shot) => {
    const next = { ...(shot.shotSpecs ?? {}) };
    if (input.lookbookSheetId) {
      if (!readLookbookSheet(session, input.lookbookSheetId)) {
        throw new ProjectDataError(
          'CORE_SHOT_REFERENCE_UNKNOWN_LOOKBOOK_SHEET',
          `Lookbook sheet was not found: ${input.lookbookSheetId}.`,
          { suggestion: 'Choose a Lookbook sheet from the current project.' }
        );
      }
      next.lookbookReference = { lookbookSheetId: input.lookbookSheetId };
    } else {
      delete next.lookbookReference;
    }
    applyShotSpecs(shot, next);
  });
  return readSceneShotListResource(input);
}

export async function updateSceneShotCustomReferenceImages(
  input: UpdateSceneShotCustomReferenceImagesInput
): Promise<SceneShotListResource> {
  await updateActiveShotSpecs(input, (session, shot) => {
    for (const inputId of input.customReferenceInputIds) {
      requireShotVideoTakeInput(session, inputId);
    }
    const next = { ...(shot.shotSpecs ?? {}) };
    next.referenceImages = {
      customReferenceInputIds: [...new Set(input.customReferenceInputIds)],
    };
    applyShotSpecs(shot, next);
  });
  return readSceneShotListResource(input);
}

export async function updateSceneShotReferenceInclusion(
  input: UpdateSceneShotReferenceInclusionInput
): Promise<SceneShotListResource> {
  await updateActiveShotSpecs(input, (_session, shot, _screenplay, document) => {
    const next = { ...(shot.shotSpecs ?? {}) };
    const referenceInclusions = { ...(next.referenceInclusions ?? {}) };
    if (input.inclusion) {
      referenceInclusions[input.dependencyId] = input.inclusion;
    } else {
      delete referenceInclusions[input.dependencyId];
    }
    if (Object.keys(referenceInclusions).length) {
      next.referenceInclusions = referenceInclusions;
    } else {
      delete next.referenceInclusions;
    }
    applyShotSpecs(shot, next);
  });
  return readSceneShotListResource(input);
}

export async function updateSceneShotGroupReferenceInclusion(
  input: UpdateSceneShotGroupReferenceInclusionInput
): Promise<SceneShotListResource> {
  const { session } = await openProjectSession(input);
  try {
    const shotListRow = readActiveSceneShotListRecord(session, input.sceneId);
    if (!shotListRow) {
      throw new ProjectDataError(
        'PROJECT_DATA329',
        `Scene has no active shot list to update: ${input.sceneId}.`,
        {
          suggestion:
            'Create or activate a shot list for this scene before editing shot specs.',
        }
      );
    }
    const screenplay = requireScreenplayDocumentFromSession(session);
    const document = readSceneShotListDocument({
      row: shotListRow,
      screenplay,
    });
    const uniqueShotIds = [...new Set(input.shotIds)];
    if (uniqueShotIds.length === 0) {
      throw new ProjectDataError(
        'PROJECT_DATA379',
        'Reference inclusion group update requires at least one shot id.',
        { suggestion: 'Send the shot ids in the current take generation.' }
      );
    }
    const shots = uniqueShotIds.map((shotId) => {
      const shot = document.shots.find((entry) => entry.shotId === shotId);
      if (!shot) {
        throw new ProjectDataError(
          'PROJECT_DATA330',
          `Shot was not found in the active shot list: ${shotId}.`,
          { suggestion: 'Use shot ids from the active shot list.' }
        );
      }
      return shot;
    });
    for (const shot of shots) {
      const next = { ...(shot.shotSpecs ?? {}) };
      const referenceInclusions = { ...(next.referenceInclusions ?? {}) };
      if (input.inclusion) {
        referenceInclusions[input.dependencyId] = input.inclusion;
      } else {
        delete referenceInclusions[input.dependencyId];
      }
      if (Object.keys(referenceInclusions).length) {
        next.referenceInclusions = referenceInclusions;
      } else {
        delete next.referenceInclusions;
      }
      applyShotSpecs(shot, next);
    }
    updateSceneShotListRecordDocument({
      session,
      id: shotListRow.id,
      document,
      screenplay,
      now: new Date().toISOString(),
    });
  } finally {
    session.close();
  }
  return readSceneShotListResource(input);
}

async function updateActiveShotSpecs(
  input: { projectName: string; sceneId: string; shotId: string; homeDir?: string },
  mutate: (
    session: DatabaseSession,
    shot: SceneShot,
    screenplay: ScreenplayDocument,
    document: SceneShotListDocument
  ) => void
): Promise<void> {
  const { session } = await openProjectSession(input);
  try {
    const shotListRow = readActiveSceneShotListRecord(session, input.sceneId);
    if (!shotListRow) {
      throw new ProjectDataError(
        'PROJECT_DATA329',
        `Scene has no active shot list to update: ${input.sceneId}.`,
        {
          suggestion:
            'Create or activate a shot list for this scene before editing shot specs.',
        }
      );
    }
    const screenplay = requireScreenplayDocument(session);
    const document = readSceneShotListDocument({
      row: shotListRow,
      screenplay,
    });
    const shot = document.shots.find((entry) => entry.shotId === input.shotId);
    if (!shot) {
      throw new ProjectDataError(
        'PROJECT_DATA330',
        `Shot was not found in the active shot list: ${input.shotId}.`,
        { suggestion: 'Use a shot id from the active shot list.' }
      );
    }
    mutate(session, shot, screenplay, document);
    updateSceneShotListRecordDocument({
      session,
      id: shotListRow.id,
      document,
      screenplay,
      now: new Date().toISOString(),
    });
  } finally {
    session.close();
  }
}

function requireScreenplayDocumentFromSession(
  session: DatabaseSession
): ScreenplayDocument {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError(
      'PROJECT_DATA012',
      'Project has no screenplay document.',
      { suggestion: 'Create or import a screenplay before editing shot references.' }
    );
  }
  return screenplay;
}

function sceneNarrativeCastMemberIds(
  screenplay: ScreenplayDocument,
  sceneId: string
): Set<string> {
  const scene = findScreenplayScene(screenplay, sceneId);
  const ids = new Set<string>();
  scene.blocks.forEach((block) => {
    if ('castMemberId' in block && block.castMemberId) {
      ids.add(block.castMemberId);
    }
    block.castMemberIds?.forEach((castMemberId) => ids.add(castMemberId));
  });
  return ids;
}

function sceneNarrativeLocationIds(
  screenplay: ScreenplayDocument,
  sceneId: string
): Set<string> {
  const scene = findScreenplayScene(screenplay, sceneId);
  const ids = new Set<string>(scene.setting.locationIds ?? []);
  scene.blocks.forEach((block) => {
    block.locationIds?.forEach((locationId) => ids.add(locationId));
  });
  return ids;
}

function findScreenplayScene(
  screenplay: ScreenplayDocument,
  sceneId: string
): ScreenplayDocument['acts'][number]['sequences'][number]['scenes'][number] {
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      const scene = sequence.scenes.find((candidate) => candidate.id === sceneId);
      if (scene) {
        return scene;
      }
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA322',
    `Scene was not found: ${sceneId}.`,
    { suggestion: 'Use a scene id from the current screenplay.' }
  );
}

function validateSceneLocationReference(
  session: DatabaseSession,
  screenplay: ScreenplayDocument,
  sceneId: string,
  locationId: string,
  options: { shot?: SceneShot } = {}
): void {
  if (!readLocationRecord(session, locationId)) {
    throw new ProjectDataError(
      'CORE_SHOT_REFERENCE_UNKNOWN_LOCATION',
      `Location was not found: ${locationId}.`,
      { suggestion: 'Choose a location from the current project.' }
    );
  }
  if (sceneNarrativeLocationIds(screenplay, sceneId).has(locationId)) {
    return;
  }
  if (options.shot && shotReferencesLocation(options.shot, locationId)) {
    return;
  }
  throw new ProjectDataError(
    'CORE_SHOT_REFERENCE_LOCATION_OUTSIDE_NARRATIVE',
    `Location is not available in this scene narrative: ${locationId}.`,
    { suggestion: 'Add the location to the scene narrative before selecting it for this shot.' }
  );
}

function shotReferencesLocation(shot: SceneShot, locationId: string): boolean {
  if (shot.shotSpecs?.location?.locationId) {
    return shot.shotSpecs.location.locationId === locationId;
  }
  return shot.locationIds.includes(locationId);
}

function validateLocationSheetAsset(
  session: DatabaseSession,
  locationId: string,
  assetId: string
): void {
  const relationship = readAssetRelationshipRecord(session, {
    target: { kind: 'location', locationId },
    assetId,
  });
  if (!relationship || relationship.role !== 'environment_sheet') {
    throw new ProjectDataError(
      'CORE_SHOT_REFERENCE_UNKNOWN_INPUT',
      `Location sheet asset does not belong to location ${locationId}: ${assetId}.`,
      { suggestion: 'Choose an environment sheet asset for the selected location.' }
    );
  }
}

function locationAzimuthViewId(
  azimuthDegrees: 0 | 90 | 180 | 270
): LocationAzimuthViewId {
  if (azimuthDegrees === 90) {
    return 'right';
  }
  if (azimuthDegrees === 180) {
    return 'back';
  }
  if (azimuthDegrees === 270) {
    return 'left';
  }
  return 'front';
}

function applyShotSpecs(
  shot: SceneShot,
  shotSpecs: ShotSpecs | null
): void {
  const previous = shot.shotSpecs;
  const normalized = normalizeShotSpecs(shotSpecs);
  if (normalized) {
    shot.shotSpecs = normalized;
  } else {
    delete shot.shotSpecs;
  }

  // Derive prompt-facing strings for axes owned by the structured specs. When
  // a previously specified axis is removed, clear its old derived text so stale
  // selections do not leak into generation prompts.
  const derived = deriveShotSpecPromptStrings(shot.shotSpecs);
  if (derived.shotType !== undefined) {
    shot.shotType = derived.shotType;
  } else if (hasShotSizeSpecs(previous)) {
    shot.shotType = 'Unspecified';
  }
  if (derived.cameraAngle !== undefined) {
    shot.cameraAngle = derived.cameraAngle;
  } else if (hasCameraAngleSpecs(previous)) {
    delete shot.cameraAngle;
  }
  if (derived.framing !== undefined) {
    shot.framing = derived.framing;
  } else if (hasFramingSpecs(previous)) {
    delete shot.framing;
  }
  if (derived.cameraMovement !== undefined) {
    shot.cameraMovement = derived.cameraMovement;
  } else if (hasMovementSpecs(previous)) {
    delete shot.cameraMovement;
  }
  if (derived.lensIntent !== undefined) {
    shot.lensIntent = derived.lensIntent;
  } else if (hasLensIntentSpecs(previous)) {
    delete shot.lensIntent;
  }
}

function hasShotSizeSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  return Boolean(shotSpecs?.shotSize);
}

function hasCameraAngleSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  return Boolean(shotSpecs?.cameraAngle || shotSpecs?.dutch);
}

function hasFramingSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  return Boolean(
    shotSpecs?.subjectFraming?.length || shotSpecs?.custom?.composition?.trim()
  );
}

function hasLensIntentSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  return Boolean(
    shotSpecs?.lens?.type ||
      shotSpecs?.lens?.millimeters !== undefined ||
      shotSpecs?.lens?.focus
  );
}

function hasMovementSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  const movement = shotSpecs?.movement;
  return Boolean(
    movement?.movement ||
      movement?.secondary ||
      movement?.track ||
      movement?.rig ||
      movement?.directions?.length ||
      shotSpecs?.custom?.movement?.trim()
  );
}

/**
 * Drop empty arrays, blank custom strings, and empty nested objects so the
 * stored specs stay minimal and satisfy the non-empty-string schema rules.
 * Returns undefined when nothing meaningful is selected.
 */
function normalizeShotSpecs(
  shotSpecs: ShotSpecs | null
): ShotSpecs | undefined {
  if (!shotSpecs) {
    return undefined;
  }
  const next: ShotSpecs = {};
  if (shotSpecs.shotSize) {
    next.shotSize = shotSpecs.shotSize;
  }
  if (shotSpecs.subjectFraming?.length) {
    next.subjectFraming = [...shotSpecs.subjectFraming];
  }
  if (shotSpecs.cameraAngle) {
    next.cameraAngle = shotSpecs.cameraAngle;
  }
  if (shotSpecs.dutch) {
    next.dutch = shotSpecs.dutch;
  }
  const movement = normalizeMovement(shotSpecs.movement);
  if (movement) {
    next.movement = movement;
  }
  const lens = normalizeLens(shotSpecs.lens);
  if (lens) {
    next.lens = lens;
  }
  const location = normalizeLocation(shotSpecs.location);
  if (location) {
    next.location = location;
  }
  const castReferences = normalizeCastReferences(shotSpecs.castReferences);
  if (castReferences) {
    next.castReferences = castReferences;
  }
  const lookbookReference = normalizeLookbookReference(
    shotSpecs.lookbookReference
  );
  if (lookbookReference) {
    next.lookbookReference = lookbookReference;
  }
  const referenceImages = normalizeReferenceImages(shotSpecs.referenceImages);
  if (referenceImages) {
    next.referenceImages = referenceImages;
  }
  const referenceInclusions = normalizeReferenceInclusions(
    shotSpecs.referenceInclusions
  );
  if (referenceInclusions) {
    next.referenceInclusions = referenceInclusions;
  }
  const custom = normalizeCustom(shotSpecs.custom);
  if (custom) {
    next.custom = custom;
  }
  return Object.keys(next).length ? next : undefined;
}

function normalizeLens(
  lens: ShotSpecs['lens']
): ShotSpecs['lens'] | undefined {
  if (!lens) {
    return undefined;
  }
  const next: NonNullable<ShotSpecs['lens']> = {};
  if (lens.type) {
    next.type = lens.type;
  }
  if (lens.millimeters !== undefined) {
    next.millimeters = lens.millimeters;
  }
  if (lens.focus) {
    next.focus = lens.focus;
  }
  return Object.keys(next).length ? next : undefined;
}

function normalizeLocation(
  location: ShotSpecs['location']
): ShotSpecs['location'] | undefined {
  if (!location) {
    return undefined;
  }
  const next: NonNullable<ShotSpecs['location']> = {};
  const locationId = location.locationId?.trim();
  if (locationId) {
    next.locationId = locationId;
  }
  const environmentSheetAssetId = location.environmentSheetAssetId?.trim();
  if (environmentSheetAssetId) {
    next.environmentSheetAssetId = environmentSheetAssetId;
  }
  if (location.viewIds?.length) {
    next.viewIds = [...new Set(location.viewIds)];
  }
  return Object.keys(next).length ? next : undefined;
}

function normalizeCastReferences(
  castReferences: ShotSpecs['castReferences']
): ShotSpecs['castReferences'] | undefined {
  if (!castReferences) {
    return undefined;
  }
  if (castReferences.castMemberIds) {
    const next: NonNullable<ShotSpecs['castReferences']> = {
      castMemberIds: [...new Set(castReferences.castMemberIds)],
    };
    if (castReferences.characterSheetAssetIds) {
      const characterSheetAssetIds = Object.fromEntries(
        Object.entries(castReferences.characterSheetAssetIds).filter(
          ([castMemberId, assetId]) => castMemberId.trim() && assetId.trim()
        )
      );
      if (Object.keys(characterSheetAssetIds).length) {
        next.characterSheetAssetIds = characterSheetAssetIds;
      }
    }
    return next;
  }
  if (castReferences.characterSheetAssetIds) {
    const characterSheetAssetIds = Object.fromEntries(
      Object.entries(castReferences.characterSheetAssetIds).filter(
        ([castMemberId, assetId]) => castMemberId.trim() && assetId.trim()
      )
    );
    if (Object.keys(characterSheetAssetIds).length) {
      return { characterSheetAssetIds };
    }
  }
  return undefined;
}

function normalizeLookbookReference(
  lookbookReference: ShotSpecs['lookbookReference']
): ShotSpecs['lookbookReference'] | undefined {
  const lookbookSheetId = lookbookReference?.lookbookSheetId?.trim();
  return lookbookSheetId ? { lookbookSheetId } : undefined;
}

function normalizeReferenceImages(
  referenceImages: ShotSpecs['referenceImages']
): ShotSpecs['referenceImages'] | undefined {
  if (!referenceImages?.customReferenceInputIds) {
    return undefined;
  }
  return {
    customReferenceInputIds: [...new Set(referenceImages.customReferenceInputIds)],
  };
}

function normalizeReferenceInclusions(
  referenceInclusions: ShotSpecs['referenceInclusions']
): ShotSpecs['referenceInclusions'] | undefined {
  if (!referenceInclusions) {
    return undefined;
  }
  const next = Object.fromEntries(
    Object.entries(referenceInclusions).filter(
      ([dependencyId, inclusion]) =>
        dependencyId.trim() &&
        (inclusion === 'include' || inclusion === 'exclude')
    )
  );
  return Object.keys(next).length ? next : undefined;
}

function normalizeMovement(
  movement: ShotSpecs['movement']
): ShotSpecs['movement'] | undefined {
  if (!movement) {
    return undefined;
  }
  const next: NonNullable<ShotSpecs['movement']> = {};
  if (movement.movement) {
    next.movement = movement.movement;
  }
  if (movement.secondary) {
    next.secondary = movement.secondary;
  }
  if (movement.directions?.length) {
    next.directions = [...movement.directions];
  }
  if (movement.track) {
    next.track = movement.track;
  }
  if (movement.rig) {
    next.rig = movement.rig;
  }
  return Object.keys(next).length ? next : undefined;
}

function normalizeCustom(
  custom: ShotSpecs['custom']
): ShotSpecs['custom'] | undefined {
  if (!custom) {
    return undefined;
  }
  const next: NonNullable<ShotSpecs['custom']> = {};
  const composition = custom.composition?.trim();
  if (composition) {
    next.composition = composition;
  }
  const movement = custom.movement?.trim();
  if (movement) {
    next.movement = movement;
  }
  return Object.keys(next).length ? next : undefined;
}

export async function readActStoryboardResource(
  input: ReadActStoryboardResourceInput
): Promise<ActStoryboardResource> {
  const { session } = await openProjectSession(input);
  try {
    const act = readActNavigationRow(session, input.actId);
    if (!act) {
      throwNotFound('act', input.actId);
    }
    const sequences: ActStoryboardSequence[] = listSequenceNavigationPage(
      session,
      { actId: input.actId, limit: 200 }
    ).items.map((sequence) => ({
      sequence,
      scenes: listSceneNavigationPage(session, {
        sequenceId: sequence.id,
        limit: 200,
      }).items.map((scene) => toActStoryboardScene(session, scene)),
    }));
    return { act, sequences };
  } finally {
    session.close();
  }
}

function toActStoryboardScene(
  session: DatabaseSession,
  scene: ActStoryboardScene['scene']
): ActStoryboardScene {
  const projection = readSceneStoryboardProjection(session, scene.id);
  if (!projection.document) {
    return { scene, shots: [] };
  }
  const shots: ActStoryboardShot[] = projection.document.shots.map(
    (shot, index) => ({
      shotId: shot.shotId,
      label: shotLabel(index),
      title: shot.title,
      image: projection.imagesByShotId[shot.shotId] ?? null,
    })
  );
  return { scene, shots };
}

export function readActiveSceneStoryboardPreviewImage(
  session: DatabaseSession,
  sceneId: string
): ScreenplayImageReference | null {
  const projection = readSceneStoryboardProjection(session, sceneId);
  const firstShotWithImage = projection.document?.shots.find(
    (shot) => projection.imagesByShotId[shot.shotId]
  );
  return firstShotWithImage
    ? projection.imagesByShotId[firstShotWithImage.shotId] ?? null
    : null;
}

export function readSceneStoryboardPreview(
  session: DatabaseSession,
  sceneId: string
): SequenceSceneStoryboardPreview | null {
  const projection = readSceneStoryboardProjection(session, sceneId);
  if (!projection.document || !projection.shotListId) {
    return null;
  }
  const selected = selectStoryboardPreviewShots(
    projection.document.shots,
    projection.imagesByShotId
  );
  return selected.length
    ? { shotListId: projection.shotListId, images: selected }
    : null;
}

interface SceneStoryboardProjection {
  document: SceneShotListDocument | null;
  shotListId: string | null;
  imagesByShotId: Record<string, ScreenplayImageReference>;
}

function readSceneStoryboardProjection(
  session: DatabaseSession,
  sceneId: string
): SceneStoryboardProjection {
  const shotListRow = readActiveSceneShotListRecord(session, sceneId);
  if (!shotListRow) {
    return { document: null, shotListId: null, imagesByShotId: {} };
  }
  const screenplay = requireScreenplayDocument(session);
  const document = readSceneShotListDocument({ row: shotListRow, screenplay });

  const imagesByShotId: Record<string, ScreenplayImageReference> = {};
  for (const image of listSceneShotStoryboardImageRecords(session, {
    shotListId: shotListRow.id,
  })) {
    if (imagesByShotId[image.shotId]) {
      continue;
    }
    const asset = readAssetRelationship(session, {
      target: { kind: 'scene', sceneId },
      assetId: image.assetId,
    });
    if (!asset) {
      continue;
    }
    const reference = toImageReferenceForFile(asset, image.assetFileId);
    if (reference) {
      imagesByShotId[image.shotId] = reference;
    }
  }

  return {
    document,
    shotListId: shotListRow.id,
    imagesByShotId,
  };
}

function selectStoryboardPreviewShots(
  shots: SceneShot[],
  imagesByShotId: Record<string, ScreenplayImageReference>
): SequenceSceneStoryboardPreview['images'] {
  const preferredIndexes = preferredPreviewIndexes(shots.length);
  const selectedIndexes: number[] = [];
  for (const index of preferredIndexes) {
    const nearest = nearestAvailablePreviewIndex({
      shots,
      imagesByShotId,
      preferredIndex: index,
      selectedIndexes,
    });
    if (nearest !== null) {
      selectedIndexes.push(nearest);
    }
  }
  return selectedIndexes
    .sort((left, right) => left - right)
    .map((index) => {
      const shot = shots[index]!;
      return { shotId: shot.shotId, image: imagesByShotId[shot.shotId] ?? null };
    });
}

function preferredPreviewIndexes(length: number): number[] {
  if (length <= 0) {
    return [];
  }
  if (length <= 4) {
    return Array.from({ length }, (_, index) => index);
  }
  return [0, 1, length - 2, length - 1];
}

function nearestAvailablePreviewIndex(input: {
  shots: SceneShot[];
  imagesByShotId: Record<string, ScreenplayImageReference>;
  preferredIndex: number;
  selectedIndexes: number[];
}): number | null {
  const selected = new Set(input.selectedIndexes);
  for (let distance = 0; distance < input.shots.length; distance += 1) {
    const candidates =
      distance === 0
        ? [input.preferredIndex]
        : [input.preferredIndex - distance, input.preferredIndex + distance];
    for (const index of candidates) {
      const shot = input.shots[index];
      if (
        shot &&
        !selected.has(index) &&
        input.imagesByShotId[shot.shotId]
      ) {
        return index;
      }
    }
  }
  return null;
}

function toImageReferenceForFile(
  asset: Asset,
  assetFileId: string
): ScreenplayImageReference | null {
  const file = asset.files.find((candidate) => candidate.id === assetFileId);
  if (!file) {
    return null;
  }
  return {
    assetId: asset.assetId,
    relationshipId: asset.relationshipId,
    assetFileId: file.id,
    title: asset.title,
    fileRole: file.role,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
  };
}

function shotLabel(index: number): string {
  return `Shot ${index + 1}`;
}

function requireScreenplayDocument(session: DatabaseSession) {
  const document = readScreenplayDocumentFromSession(session);
  if (!document) {
    throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
      suggestion: 'Create screenplay data before opening this surface.',
    });
  }
  return document;
}

function throwNotFound(label: string, id: string): never {
  throw new ProjectDataError(
    'PROJECT_DATA205',
    `No ${label} was found for this screenplay request: ${id}.`,
    { suggestion: 'Check the id from the latest screenplay resource.' }
  );
}
