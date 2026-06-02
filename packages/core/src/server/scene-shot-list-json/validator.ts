import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createDiagnosticWarning,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
  type DiagnosticResult,
} from '@gorenku/studio-diagnostics';
import type {
  SceneShot,
  SceneShotListDocument,
  ShotVideoTakeDependencyKind,
  ShotVideoTakeInputKind,
  ShotVideoTakeProductionGroup,
} from '../../client/scene-shot-list.js';
import type { ShotVideoTakeInputGenerationPurpose } from '../../client/media-generation.js';
import { sceneShotListDocumentSchema } from '../../client/scene-shot-list-json-schemas.js';
import type { ScreenplayDocument } from '../../client/screenplay.js';

const SHOT_LIST_DIAGNOSTIC_CODE = 'PROJECT_DATA320';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addSchema(sceneShotListDocumentSchema);

export function parseSceneShotListDocument(input: {
  contents: string;
  filePath?: string;
}): SceneShotListDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.contents);
  } catch {
    throwInvalidShotListJson(input.filePath);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throwInvalidShotListJson(input.filePath);
  }
  return parsed as SceneShotListDocument;
}

export function validateSceneShotListDocument(input: {
  document: SceneShotListDocument;
  screenplay: ScreenplayDocument;
  filePath?: string;
}): DiagnosticResult {
  const shapeIssues = validateSceneShotListShape(input.document, input.filePath);
  const issues =
    shapeIssues.length > 0
      ? shapeIssues
      : [...shapeIssues, ...validateSceneShotListSemantics(input)];
  return buildDiagnosticResult(issues);
}

export function assertSceneShotListDocument(input: {
  document: SceneShotListDocument;
  screenplay: ScreenplayDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  const result = validateSceneShotListDocument(input);
  throwIfDiagnosticResultInvalid(result, {
    code: SHOT_LIST_DIAGNOSTIC_CODE,
    message: 'Scene Shot List JSON failed validation.',
    suggestion: 'Fix the reported Scene Shot List issues and run the command again.',
  });
  return result.warnings;
}

export function parseStoredSceneShotListDocument(input: {
  value: string;
  screenplay: ScreenplayDocument;
  path?: string[];
}): SceneShotListDocument {
  let parsed: SceneShotListDocument;
  try {
    parsed = JSON.parse(input.value) as SceneShotListDocument;
  } catch {
    throwIfDiagnosticResultInvalid(
      buildDiagnosticResult([
        createDiagnosticError(
          'PROJECT_DATA201',
          'Stored Scene Shot List document must be valid JSON.',
          { path: input.path ?? ['sceneShotList', 'document'] },
          'Repair the stored Scene Shot List JSON.'
        ),
      ]),
      {
        code: 'PROJECT_DATA201',
        message: 'Stored Scene Shot List JSON failed validation.',
        suggestion: 'Repair the stored Scene Shot List JSON.',
      }
    );
    throw new Error('unreachable');
  }
  const result = validateSceneShotListDocument({
    document: parsed,
    screenplay: input.screenplay,
  });
  throwIfDiagnosticResultInvalid(result, {
    code: SHOT_LIST_DIAGNOSTIC_CODE,
    message: 'Stored Scene Shot List JSON failed validation.',
    suggestion: 'Repair the stored Scene Shot List JSON.',
  });
  return parsed;
}

export function serializeSceneShotListDocument(input: {
  document: SceneShotListDocument;
  screenplay: ScreenplayDocument;
  filePath?: string;
}): string {
  assertSceneShotListDocument(input);
  return JSON.stringify(input.document);
}

function validateSceneShotListShape(
  document: unknown,
  filePath?: string
): DiagnosticIssue[] {
  const validator = ajv.getSchema(sceneShotListDocumentSchema.$id);
  if (!validator) {
    throw new Error('Scene Shot List JSON schema was not registered.');
  }
  const valid = validator(document);
  return valid ? [] : mapAjvErrors(validator.errors ?? [], filePath);
}

function validateSceneShotListSemantics(input: {
  document: SceneShotListDocument;
  screenplay: ScreenplayDocument;
  filePath?: string;
}): DiagnosticIssue[] {
  const { document, screenplay, filePath } = input;
  const scene = findScene(screenplay, document.sceneId);
  const issues: DiagnosticIssue[] = [];
  if (!scene) {
    issues.push(
      error(
        'Scene Shot List references an unknown scene.',
        ['sceneId'],
        filePath,
        'Use a scene id from `renku screenplay shot-list context --scene <id> --json`.'
      )
    );
    return issues;
  }

  const context = buildSceneValidationContext(screenplay, scene);
  const shotIds = new Set<string>();
  const coveredBlocks = new Set<number>();
  document.shots.forEach((shot, shotIndex) => {
    const shotPath = ['shots', String(shotIndex)];
    if (shotIds.has(shot.shotId)) {
      issues.push(
        error(
          'Duplicate shotId in Scene Shot List.',
          [...shotPath, 'shotId'],
          filePath,
          'Use each shotId only once within the shot list.'
        )
      );
    }
    shotIds.add(shot.shotId);
    validateNoAbsoluteOrGeneratedPaths(shot, shotPath, issues, filePath);
    shot.coveredBlockIndexes.forEach((blockIndex, blockReferenceIndex) => {
      if (blockIndex < 0 || blockIndex >= scene.blocks.length) {
        issues.push(
          error(
            'Shot references a screenplay block index outside the scene.',
            [
              ...shotPath,
              'coveredBlockIndexes',
              String(blockReferenceIndex),
            ],
            filePath,
            'Use zero-based block indexes from the current scene context.'
          )
        );
        return;
      }
      coveredBlocks.add(blockIndex);
    });
    if (shot.coveredBlockIndexes.length === 0) {
      issues.push(
        warning(
          'Shot references no screenplay block.',
          [...shotPath, 'coveredBlockIndexes'],
          filePath,
          'Connect the shot to the nearest scene block when possible.'
        )
      );
    }
    shot.castMemberIds.forEach((castMemberId, castIndex) => {
      if (!context.castMemberIds.has(castMemberId)) {
        issues.push(
          error(
            'Shot references an unknown cast member.',
            [...shotPath, 'castMemberIds', String(castIndex)],
            filePath,
            'Use a cast member id from the current project.'
          )
        );
      } else if (
        !context.sceneCastMemberIds.has(castMemberId) &&
        !hasUsefulNote(shot.productionNotes)
      ) {
        issues.push(
          warning(
            'Shot references a cast member outside the scene without a note.',
            [...shotPath, 'castMemberIds', String(castIndex)],
            filePath,
            'Explain the intentional out-of-scene reference in productionNotes.'
          )
        );
      }
    });
    shot.locationIds.forEach((locationId, locationIndex) => {
      if (!context.locationIds.has(locationId)) {
        issues.push(
          error(
            'Shot references an unknown location.',
            [...shotPath, 'locationIds', String(locationIndex)],
            filePath,
            'Use a location id from the current project.'
          )
        );
      } else if (
        !context.sceneLocationIds.has(locationId) &&
        !hasUsefulNote(shot.productionNotes)
      ) {
        issues.push(
          warning(
            'Shot references a location outside the scene without a note.',
            [...shotPath, 'locationIds', String(locationIndex)],
            filePath,
            'Explain the intentional out-of-scene reference in productionNotes.'
          )
        );
      }
    });
    validateShotSpecsSemantics(shot, shotPath, context, issues, filePath);
    shot.dialogue.forEach((dialogue, dialogueIndex) => {
      const block = scene.blocks[dialogue.blockIndex];
      if (!block) {
        issues.push(
          error(
            'Dialogue reference points outside the scene blocks.',
            [...shotPath, 'dialogue', String(dialogueIndex), 'blockIndex'],
            filePath,
            'Use a block index from the current scene context.'
          )
        );
        return;
      }
      if (block.type !== 'dialogue') {
        issues.push(
          error(
            'Dialogue reference must point at a dialogue block.',
            [...shotPath, 'dialogue', String(dialogueIndex), 'blockIndex'],
            filePath,
            'Reference a block with type "dialogue".'
          )
        );
      }
      dialogue.lineIndexes?.forEach((lineIndex, lineReferenceIndex) => {
        if (block.type !== 'dialogue' || lineIndex >= block.lines.length) {
          issues.push(
            error(
              'Dialogue line index is outside the referenced dialogue block.',
              [
                ...shotPath,
                'dialogue',
                String(dialogueIndex),
                'lineIndexes',
                String(lineReferenceIndex),
              ],
              filePath,
              'Use zero-based line indexes from the referenced dialogue block.'
            )
          );
        }
      });
      if (
        dialogue.castMemberId &&
        !context.castMemberIds.has(dialogue.castMemberId)
      ) {
        issues.push(
          error(
            'Dialogue reference uses an unknown cast member.',
            [...shotPath, 'dialogue', String(dialogueIndex), 'castMemberId'],
            filePath,
            'Use a cast member id from the current project.'
          )
        );
      }
      if (!shot.coveredBlockIndexes.includes(dialogue.blockIndex)) {
        issues.push(
          warning(
            'Shot has dialogue text but does not cite that dialogue block in coveredBlockIndexes.',
            [...shotPath, 'dialogue', String(dialogueIndex), 'blockIndex'],
            filePath,
            'Add the dialogue block index to coveredBlockIndexes.'
          )
        );
      }
    });
  });

  scene.blocks.forEach((block, blockIndex) => {
    if (block.type === 'dialogue' && !coveredBlocks.has(blockIndex)) {
      issues.push(
        warning(
          'Shot list leaves a dialogue block uncovered.',
          ['shots'],
          filePath,
          `Cover dialogue block ${blockIndex} or leave a deliberate note.`
        )
      );
    }
  });
  validateShotVideoTakeProductionGroups(document, issues, filePath);

  return issues;
}

function validateShotVideoTakeProductionGroups(
  document: SceneShotListDocument,
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const groups = document.videoTakeProductionGroups ?? [];
  const shotOrder = new Map(
    document.shots.map((shot, index) => [shot.shotId, index])
  );
  const assignedShotIds = new Map<string, string>();
  const productionGroupIds = new Set<string>();
  groups.forEach((group, groupIndex) => {
    const groupPath = ['videoTakeProductionGroups', String(groupIndex)];
    if (productionGroupIds.has(group.productionGroupId)) {
      issues.push(
        error(
          'Duplicate shot video take productionGroupId.',
          [...groupPath, 'productionGroupId'],
          filePath,
          'Use one stable productionGroupId per production group.'
        )
      );
    }
    productionGroupIds.add(group.productionGroupId);
    const sortedShotIds = [...group.shotIds].sort(
      (left, right) => (shotOrder.get(left) ?? Infinity) - (shotOrder.get(right) ?? Infinity)
    );
    group.shotIds.forEach((shotId, shotIndex) => {
      if (!shotOrder.has(shotId)) {
        issues.push(
          error(
            'Shot video take production group references an unknown shot.',
            [...groupPath, 'shotIds', String(shotIndex)],
            filePath,
            'Use shot ids from this Scene Shot List.'
          )
        );
      }
      const existingGroupId = assignedShotIds.get(shotId);
      if (existingGroupId) {
        issues.push(
          error(
            'Shot belongs to more than one video take production group.',
            [...groupPath, 'shotIds', String(shotIndex)],
            filePath,
            `Remove this shot from either ${existingGroupId} or ${group.productionGroupId}.`
          )
        );
      }
      assignedShotIds.set(shotId, group.productionGroupId);
      if (sortedShotIds[shotIndex] !== shotId) {
        issues.push(
          error(
            'Shot video take production group shotIds must be stored in shot-list order.',
            [...groupPath, 'shotIds'],
            filePath,
            'Save the group with shot ids ordered exactly as they appear in the active Scene Shot List.'
          )
        );
      }
    });
    if (group.shotIds.length > 1 && !isContiguousShotGroup(group, shotOrder)) {
      issues.push(
        error(
          'Multi-shot video take production groups must be contiguous.',
          [...groupPath, 'shotIds'],
          filePath,
          'Select adjacent shots or split the group into separate production groups.'
        )
      );
    }
    validateShotVideoTakeIntentForGroup(group, groupPath, issues, filePath);
    validateShotVideoTakeAgentProposal(group, groupPath, issues, filePath);
  });
}

function isContiguousShotGroup(
  group: ShotVideoTakeProductionGroup,
  shotOrder: Map<string, number>
): boolean {
  const indexes = group.shotIds.map((shotId) => shotOrder.get(shotId));
  if (indexes.some((index) => index === undefined)) {
    return false;
  }
  return indexes.every((index, position) => {
    if (position === 0) {
      return true;
    }
    return index === (indexes[position - 1] as number) + 1;
  });
}

function validateShotVideoTakeIntentForGroup(
  group: ShotVideoTakeProductionGroup,
  groupPath: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const intentId = group.videoTakeProduction.intentId;
  if (!intentId) {
    return;
  }
  if (group.shotIds.length === 1 && intentId === 'multi-shot') {
    issues.push(
      error(
        'Single-shot video take production groups cannot use the multi-shot intent.',
        [...groupPath, 'videoTakeProduction', 'intentId'],
        filePath,
        'Choose a single-shot intent such as first-frame, first-last-frame, reference, or text-only.'
      )
    );
  }
  if (group.shotIds.length > 1 && intentId !== 'multi-shot') {
    issues.push(
      error(
        'Multi-shot video take production groups must use the multi-shot intent.',
        [...groupPath, 'videoTakeProduction', 'intentId'],
        filePath,
        'Use intentId "multi-shot" for grouped adjacent shots.'
      )
    );
  }
}

function validateShotVideoTakeAgentProposal(
  group: ShotVideoTakeProductionGroup,
  groupPath: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const proposal = group.videoTakeProduction.agentProposal;
  if (!proposal) {
    return;
  }
  const plan = group.videoTakeProduction;
  if (plan.intentId && proposal.basedOnIntentId !== plan.intentId) {
    issues.push(
      error(
        'Shot video take agent proposal is stale for the selected intent.',
        [...groupPath, 'videoTakeProduction', 'agentProposal', 'basedOnIntentId'],
        filePath,
        'Refresh the proposal after changing intent.'
      )
    );
  }
  if (plan.modelChoice && proposal.basedOnModelChoice !== plan.modelChoice) {
    issues.push(
      error(
        'Shot video take agent proposal is stale for the selected model.',
        [...groupPath, 'videoTakeProduction', 'agentProposal', 'basedOnModelChoice'],
        filePath,
        'Refresh the proposal after changing model.'
      )
    );
  }
  proposal.dependencyDrafts.forEach((draft, draftIndex) => {
    const expected = dependencyPurposeMapping(draft.dependencyKind);
    if (!expected) {
      return;
    }
    if (draft.purpose !== expected.purpose || draft.outputInputKind !== expected.outputInputKind) {
      issues.push(
        error(
          'Shot video take dependency draft purpose does not match its dependency kind.',
          [
            ...groupPath,
            'videoTakeProduction',
            'agentProposal',
            'dependencyDrafts',
            String(draftIndex),
          ],
          filePath,
          'Use the concrete dependency purpose and output input kind for the selected dependency kind.'
        )
      );
    }
  });
}

function dependencyPurposeMapping(
  kind: ShotVideoTakeDependencyKind
): { purpose: ShotVideoTakeInputGenerationPurpose; outputInputKind: ShotVideoTakeInputKind } | null {
  if (kind === 'first-frame') {
    return { purpose: 'shot.first-frame', outputInputKind: 'first-frame' };
  }
  if (kind === 'last-frame') {
    return { purpose: 'shot.last-frame', outputInputKind: 'last-frame' };
  }
  if (kind === 'shot-reference-sheet') {
    return { purpose: 'shot.reference-sheet', outputInputKind: 'shot-reference-sheet' };
  }
  if (kind === 'multi-shot-storyboard-sheet') {
    return {
      purpose: 'shot.multi-shot-storyboard-sheet',
      outputInputKind: 'multi-shot-storyboard-sheet',
    };
  }
  return null;
}

function validateShotSpecsSemantics(
  shot: SceneShot,
  shotPath: string[],
  context: ReturnType<typeof buildSceneValidationContext>,
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const design = shot.shotSpecs;
  if (!design) {
    return;
  }
  validateShotSpecsLocation(shot, shotPath, context, issues, filePath);
  validateShotSpecsLens(shot, shotPath, issues, filePath);
}

function validateShotSpecsLocation(
  shot: SceneShot,
  shotPath: string[],
  context: ReturnType<typeof buildSceneValidationContext>,
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const location = shot.shotSpecs?.location;
  if (!location) {
    return;
  }
  const locationPath = [...shotPath, 'shotSpecs', 'location'];
  if (location.locationId) {
    if (location.usesDifferentLocation === true) {
      if (!context.locationIds.has(location.locationId)) {
        issues.push(
          error(
            'Shot location override references an unknown project location.',
            [...locationPath, 'locationId'],
            filePath,
            'Use a location id from the current project.'
          )
        );
      }
    } else if (!shot.locationIds.includes(location.locationId)) {
      issues.push(
        error(
          'Shot specs location must be one of the shot locationIds unless usesDifferentLocation is true.',
          [...locationPath, 'locationId'],
          filePath,
          'Choose a shot location id, or set usesDifferentLocation to true for an intentional override.'
        )
      );
    }
  }
  if (location.azimuthView && location.customView) {
    issues.push(
      error(
        'Shot location specs cannot use both azimuthView and customView.',
        locationPath,
        filePath,
        'Choose an environment-sheet azimuth view or describe a custom view, not both.'
      )
    );
  }
  if (
    location.customView !== undefined &&
    location.customView.trim().length < 3
  ) {
    issues.push(
      error(
        'Shot location customView must contain useful text.',
        [...locationPath, 'customView'],
        filePath,
        'Describe the intended view in a few words.'
      )
    );
  }
}

function validateShotSpecsLens(
  shot: SceneShot,
  shotPath: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const lens = shot.shotSpecs?.lens;
  const lensPath = [...shotPath, 'shotSpecs', 'lens'];
  if (lens?.millimeters !== undefined && !lens.type) {
    issues.push(
      error(
        'Shot lens millimeters requires a lens type selection.',
        [...lensPath, 'millimeters'],
        filePath,
        'Set lens.type before setting lens.millimeters.'
      )
    );
  }
  if (
    lens?.millimeters !== undefined &&
    (lens.millimeters < 1 || lens.millimeters > 300)
  ) {
    issues.push(
      error(
        'Shot lens millimeters must be between 1 and 300.',
        [...lensPath, 'millimeters'],
        filePath,
        'Use a practical lens millimeter value from 1 to 300.'
      )
    );
  }
  const movement = shot.shotSpecs?.movement;
  const hasRackFocusMovement =
    movement?.movement === 'rack-focus' || movement?.secondary === 'rack-focus';
  if (hasRackFocusMovement && lens?.focus !== 'rack-focus') {
    issues.push(
      error(
        'Rack-focus camera motion requires rack-focus composition focus.',
        [...lensPath, 'focus'],
        filePath,
        'Set lens.focus to rack-focus or choose a different camera motion.'
      )
    );
  }
}

function buildSceneValidationContext(
  screenplay: ScreenplayDocument,
  scene: NonNullable<ReturnType<typeof findScene>>
): {
  castMemberIds: Set<string>;
  locationIds: Set<string>;
  sceneCastMemberIds: Set<string>;
  sceneLocationIds: Set<string>;
} {
  const sceneCastMemberIds = new Set<string>();
  const sceneLocationIds = new Set<string>(scene.setting.locationIds ?? []);
  for (const block of scene.blocks) {
    for (const castMemberId of block.castMemberIds ?? []) {
      sceneCastMemberIds.add(castMemberId);
    }
    if (block.type === 'dialogue' && block.castMemberId) {
      sceneCastMemberIds.add(block.castMemberId);
    }
    for (const locationId of block.locationIds ?? []) {
      sceneLocationIds.add(locationId);
    }
  }
  return {
    castMemberIds: new Set(
      screenplay.cast.map((castMember) => castMember.id).filter(Boolean) as string[]
    ),
    locationIds: new Set(
      screenplay.locations.map((location) => location.id).filter(Boolean) as string[]
    ),
    sceneCastMemberIds,
    sceneLocationIds,
  };
}

function validateNoAbsoluteOrGeneratedPaths(
  shot: SceneShot,
  shotPath: string[],
  issues: DiagnosticIssue[],
  filePath?: string
): void {
  const fields: Array<[keyof SceneShot, string | undefined]> = [
    ['title', shot.title],
    ['storyBeat', shot.storyBeat],
    ['narrativePurpose', shot.narrativePurpose],
    ['description', shot.description],
    ['subject', shot.subject],
    ['action', shot.action],
    ['audioNotes', shot.audioNotes],
    ['productionNotes', shot.productionNotes],
  ];
  for (const [field, value] of fields) {
    if (!value) {
      continue;
    }
    if (containsDisallowedPath(value)) {
      issues.push(
        error(
          'Shot text must not store absolute paths or generated image paths.',
          [...shotPath, field],
          filePath,
          'Attach generated storyboard files through media import instead.'
        )
      );
    }
  }
}

function containsDisallowedPath(value: string): boolean {
  return (
    /(^|\s)(\/Users\/|\/private\/|\/var\/|\/tmp\/|[A-Za-z]:\\)/.test(value) ||
    value.includes('generated/media/')
  );
}

function findScene(
  screenplay: ScreenplayDocument,
  sceneId: string
): (ScreenplayDocument['acts'][number]['sequences'][number]['scenes'][number] & {
  actId?: string;
  sequenceId?: string;
}) | null {
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id === sceneId) {
          return {
            ...scene,
            actId: act.id,
            sequenceId: sequence.id,
          };
        }
      }
    }
  }
  return null;
}

function throwInvalidShotListJson(filePath?: string): never {
  throwIfDiagnosticResultInvalid(
    buildDiagnosticResult([
      createDiagnosticError(
        'PROJECT_DATA201',
        'Input must be a valid JSON object.',
        { path: [], ...(filePath ? { filePath } : {}) },
        'Provide a valid JSON object.'
      ),
    ]),
    {
      code: 'PROJECT_DATA201',
      message: 'Input must be a valid JSON object.',
      suggestion: 'Provide a valid JSON object.',
    }
  );
  throw new Error('unreachable');
}

function mapAjvErrors(
  errors: ErrorObject[],
  filePath?: string
): DiagnosticIssue[] {
  return errors
    .filter((validationError) => validationError.keyword !== 'if')
    .map((validationError) => {
      const path = pointerToPath(validationError.instancePath);
      if (validationError.keyword === 'required') {
        const missing = String(validationError.params.missingProperty);
        return error(
          `${missing} is required.`,
          [...path, missing],
          filePath,
          `Add the required ${missing} field.`
        );
      }
      if (validationError.keyword === 'additionalProperties') {
        const field = String(validationError.params.additionalProperty);
        return error(
          `Unknown field is not allowed: ${field}.`,
          [...path, field],
          filePath,
          'Remove the field or add it to the Scene Shot List contract.'
        );
      }
      if (
        validationError.keyword === 'const' ||
        validationError.keyword === 'enum'
      ) {
        return error(
          `Unsupported value at ${formatPath(path)}.`,
          path,
          filePath,
          'Use one of the documented values.'
        );
      }
      return error(
        `Invalid value at ${formatPath(path)}.`,
        path,
        filePath,
        'Use the documented type and value range for this field.'
      );
    });
}

function error(
  message: string,
  path: string[],
  filePath?: string,
  suggestion?: string
): DiagnosticIssue {
  return createDiagnosticError(
    SHOT_LIST_DIAGNOSTIC_CODE,
    message,
    { path, ...(filePath ? { filePath } : {}) },
    suggestion
  );
}

function warning(
  message: string,
  path: string[],
  filePath?: string,
  suggestion?: string
): DiagnosticIssue {
  return createDiagnosticWarning(
    SHOT_LIST_DIAGNOSTIC_CODE,
    message,
    { path, ...(filePath ? { filePath } : {}) },
    suggestion
  );
}

function pointerToPath(pointer: string): string[] {
  if (!pointer) {
    return [];
  }
  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function formatPath(path: string[]): string {
  return path.length > 0 ? path.join('.') : '<root>';
}

function hasUsefulNote(value: string | undefined): boolean {
  return (value ?? '').trim().length >= 8;
}
