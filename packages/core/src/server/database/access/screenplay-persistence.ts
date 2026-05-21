import {
  createDiagnosticError,
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  GeneratedId,
  Reference,
  Scene,
  ScreenplayDocument,
  Sequence,
} from '../../../client/screenplay.js';
import {
  acts,
  blockCastMembers,
  blockLocations,
  blocks,
  castAssets,
  castMembers,
  locationAssets,
  locations,
  sceneLocations,
  sceneAssets,
  scenes,
  screenplay,
  sequenceAssets,
  sequences,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type EntityIdPrefix,
  type ProjectIdGenerator,
} from '../../entity-ids.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface ResolvedScreenplayDocument {
  document: ScreenplayDocument;
  generatedIds: GeneratedId[];
  warnings: DiagnosticIssue[];
}

export function resolveScreenplayDocumentIds(input: {
  document: ScreenplayDocument;
  existing?: ScreenplayDocument | null;
  idGenerator?: ProjectIdGenerator;
}): ResolvedScreenplayDocument {
  const document = structuredClone(input.document);
  const generatedIds: GeneratedId[] = [];
  const allocator = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const localKeys = {
    cast: new Map<string, string>(),
    locations: new Map<string, string>(),
    acts: new Map<string, string>(),
    sequences: new Map<string, string>(),
    scenes: new Map<string, string>(),
    blocks: new Map<string, string>(),
  };

  const issues: DiagnosticIssue[] = [];
  const warnings: DiagnosticIssue[] = [];
  assignCollectionIds(document.cast, 'cast', ['cast'], 'cast', localKeys.cast, generatedIds, allocator, issues);
  assignCollectionIds(document.locations, 'location', ['locations'], 'location', localKeys.locations, generatedIds, allocator, issues);
  document.acts.forEach((act, actIndex) => {
    assignObjectId(act, 'act', ['acts', String(actIndex)], 'act', localKeys.acts, generatedIds, allocator, issues);
    act.sequences.forEach((sequence, sequenceIndex) => {
      assignObjectId(sequence, 'sequence', ['acts', String(actIndex), 'sequences', String(sequenceIndex)], 'sequence', localKeys.sequences, generatedIds, allocator, issues);
      sequence.scenes.forEach((scene, sceneIndex) => {
        assignObjectId(scene, 'scene', ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes', String(sceneIndex)], 'scene', localKeys.scenes, generatedIds, allocator, issues);
        scene.blocks.forEach((block, blockIndex) =>
          assignObjectId(block, 'block', ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes', String(sceneIndex), 'blocks', String(blockIndex)], 'block', localKeys.blocks, generatedIds, allocator, issues)
        );
      });
    });
  });

  if (issues.length > 0) {
    throwValidation(issues);
  }

  collectDuplicateIds(document, issues);

  if (issues.length > 0) {
    throwValidation(issues);
  }

  const castIds = new Set(document.cast.map((castMember) => castMember.id ?? ''));
  const locationIds = new Set(document.locations.map((location) => location.id ?? ''));
  document.acts.forEach((act, actIndex) =>
    act.sequences.forEach((sequence, sequenceIndex) =>
      sequence.scenes.forEach((scene, sceneIndex) => {
        scene.setting.locationIds = scene.setting.locationRefs
          ? resolveRefs(
              scene.setting.locationRefs,
              locationIds,
              localKeys.locations,
              ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes', String(sceneIndex), 'setting', 'locationRefs'],
              issues,
              warnings
            )
          : validateDurableIds(
              scene.setting.locationIds ?? [],
              locationIds,
              ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes', String(sceneIndex), 'setting', 'locationIds'],
              issues,
              warnings
            );
        delete scene.setting.locationRefs;
        scene.blocks.forEach((block, blockIndex) => {
          const blockPath = ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes', String(sceneIndex), 'blocks', String(blockIndex)];
          block.castMemberIds = block.castMemberRefs
            ? resolveRefs(block.castMemberRefs, castIds, localKeys.cast, [...blockPath, 'castMemberRefs'], issues, warnings)
            : validateDurableIds(block.castMemberIds ?? [], castIds, [...blockPath, 'castMemberIds'], issues, warnings);
          block.locationIds = block.locationRefs
            ? resolveRefs(block.locationRefs, locationIds, localKeys.locations, [...blockPath, 'locationRefs'], issues, warnings)
            : validateDurableIds(block.locationIds ?? [], locationIds, [...blockPath, 'locationIds'], issues, warnings);
          delete block.castMemberRefs;
          delete block.locationRefs;
          if (block.type === 'dialogue') {
            block.castMemberId = block.castMemberRef
              ? resolveRef(block.castMemberRef, castIds, localKeys.cast, [...blockPath, 'castMemberRef'], issues)
              : block.castMemberId;
            delete block.castMemberRef;
          }
        });
      })
    )
  );

  if (issues.length > 0) {
    throwValidation(issues);
  }

  return { document, generatedIds, warnings };
}

function validateDurableIds(
  ids: string[],
  durableIds: Set<string>,
  path: string[],
  issues: DiagnosticIssue[],
  warnings: DiagnosticIssue[]
): string[] {
  const resolved: string[] = [];
  ids.forEach((id, index) => {
    if (!durableIds.has(id)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA210',
          'Reference points to an unknown object.',
          { path: [...path, String(index)] },
          'Reference an existing object id.'
        )
      );
      return;
    }
    addUniqueResolvedId(resolved, id, [...path, String(index)], warnings);
  });
  return resolved;
}

function collectDuplicateIds(
  document: ScreenplayDocument,
  issues: DiagnosticIssue[]
): void {
  collectDuplicateIdsInCollection(document.cast, ['cast'], issues);
  collectDuplicateIdsInCollection(document.locations, ['locations'], issues);
  collectDuplicateIdsInCollection(document.acts, ['acts'], issues);
  document.acts.forEach((act, actIndex) => {
    collectDuplicateIdsInCollection(
      act.sequences,
      ['acts', String(actIndex), 'sequences'],
      issues
    );
    act.sequences.forEach((sequence, sequenceIndex) => {
      collectDuplicateIdsInCollection(
        sequence.scenes,
        ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes'],
        issues
      );
      sequence.scenes.forEach((scene, sceneIndex) => {
        collectDuplicateIdsInCollection(
          scene.blocks,
          [
            'acts',
            String(actIndex),
            'sequences',
            String(sequenceIndex),
            'scenes',
            String(sceneIndex),
            'blocks',
          ],
          issues
        );
      });
    });
  });
}

function collectDuplicateIdsInCollection(
  values: Array<{ id?: string }>,
  path: string[],
  issues: DiagnosticIssue[]
): void {
  const firstPathById = new Map<string, string[]>();
  values.forEach((value, index) => {
    if (!value.id) {
      return;
    }
    const idPath = [...path, String(index), 'id'];
    const firstPath = firstPathById.get(value.id);
    if (firstPath) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA209',
          `Duplicate id: ${value.id}.`,
          { path: idPath, context: `First seen at ${firstPath.join('.')}` },
          'Remove the duplicate or use a different durable id.'
        )
      );
      return;
    }
    firstPathById.set(value.id, idPath);
  });
}

export function replaceScreenplayDocument(session: DatabaseSession, document: ScreenplayDocument): void {
  assertNoScreenplayAssetRelationships(session);
  try {
    session.db.transaction(() => {
      deleteScreenplayTables(session);
      session.db.insert(screenplay).values({
      title: document.screenplay.title,
      intendedAudience: document.screenplay.intendedAudience ?? null,
      targetLengthLabel: document.screenplay.targetLengthLabel ?? null,
      estimatedMinutes: document.screenplay.estimatedMinutes ?? null,
      genrePrimary: document.screenplay.genrePrimary ?? null,
      genreSecondary: stringifyArray(document.screenplay.genreSecondary),
      tone: stringifyArray(document.screenplay.tone),
      ratingIntent: document.screenplay.ratingIntent ?? null,
      boundaries: stringifyArray(document.screenplay.boundaries),
      logline: document.screenplay.logline ?? null,
      summary: document.screenplay.summary ?? null,
      premiseOverview: document.screenplay.premiseOverview ?? null,
      centralConflict: document.screenplay.centralConflict ?? null,
      dramaticQuestion: document.screenplay.dramaticQuestion ?? null,
      themes: stringifyArray(document.screenplay.themes),
      historicalBasis: stringifyArray(document.screenplay.historicalBasis),
      dramatizedElements: stringifyArray(document.screenplay.dramatizedElements),
      structureModel: document.screenplay.structureModel ?? null,
      status: document.screenplay.status ?? null,
      researchSources: stringifyArray(document.screenplay.researchSources),
      assumptionsMade: stringifyArray(document.screenplay.assumptionsMade),
      }).run();

    document.cast.forEach((castMember, index) => {
      session.db.insert(castMembers).values({
        id: requiredId(castMember),
        name: castMember.name,
        role: castMember.role ?? null,
        age: castMember.age ?? null,
        want: castMember.want ?? null,
        need: castMember.need ?? null,
        arc: castMember.arc ?? null,
        voiceNotes: castMember.voiceNotes ?? null,
        description: castMember.description ?? null,
        position: index,
      }).run();
    });

    document.locations.forEach((location, index) => {
      session.db.insert(locations).values({
        id: requiredId(location),
        name: location.name,
        timePeriod: location.timePeriod ?? null,
        description: location.description ?? null,
        visualNotes: location.visualNotes ?? null,
        position: index,
      }).run();
    });

    document.acts.forEach((act, actIndex) => {
      session.db.insert(acts).values({
        id: requiredId(act),
        title: act.title ?? `Act ${actIndex + 1}`,
        purpose: act.purpose ?? null,
        keyBeats: stringifyArray(act.keyBeats),
        position: actIndex,
      }).run();
      act.sequences.forEach((sequence, sequenceIndex) => {
        session.db.insert(sequences).values({
          id: requiredId(sequence),
          actId: requiredId(act),
          title: sequence.title ?? `Sequence ${sequenceIndex + 1}`,
          purpose: sequence.purpose ?? null,
          position: sequenceIndex,
        }).run();
        sequence.scenes.forEach((scene, sceneIndex) => insertScene(session, sequence, scene, sceneIndex));
      });
    });
    });
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'PROJECT_DATA219',
      error instanceof Error
        ? `Screenplay write failed: ${error.message}`
        : 'Screenplay write failed.',
      {
        suggestion: 'Fix the reported database issue and run the command again.',
      }
    );
  }
}

function assertNoScreenplayAssetRelationships(session: DatabaseSession): void {
  const relationship = [
    session.db.select({ id: castAssets.id }).from(castAssets).get(),
    session.db.select({ id: locationAssets.id }).from(locationAssets).get(),
    session.db.select({ id: sequenceAssets.id }).from(sequenceAssets).get(),
    session.db.select({ id: sceneAssets.id }).from(sceneAssets).get(),
  ].find(Boolean);
  if (!relationship) {
    return;
  }
  throw new ProjectDataError(
    'PROJECT_DATA213',
    'Screenplay changes would orphan existing asset relationships.',
    {
      issues: [
        createDiagnosticError(
          'PROJECT_DATA213',
          'Screenplay changes would orphan existing asset relationships.',
          { path: ['screenplay'] },
          'Remove or move the dependent assets before replacing screenplay rows.'
        ),
      ],
      suggestion: 'Remove or move dependent assets before changing screenplay rows.',
    }
  );
}

function insertScene(
  session: DatabaseSession,
  sequence: Sequence,
  scene: Scene,
  sceneIndex: number
): void {
  session.db.insert(scenes).values({
    id: requiredId(scene),
    sequenceId: requiredId(sequence),
    title: scene.title,
    interiorExterior: scene.setting.interiorExterior ?? null,
    timeOfDay: scene.setting.timeOfDay ?? null,
    storyFunction: stringifyArray(scene.storyFunction),
    position: sceneIndex,
  }).run();
  (scene.setting.locationIds ?? []).forEach((locationId, locationIndex) => {
    session.db.insert(sceneLocations).values({
      sceneId: requiredId(scene),
      locationId,
      position: locationIndex,
    }).run();
  });
  scene.blocks.forEach((block, blockIndex) => {
    session.db.insert(blocks).values({
      id: requiredId(block),
      sceneId: requiredId(scene),
      type: block.type,
      text: block.type === 'action' ? block.text : null,
      castId: block.type === 'dialogue' ? block.castMemberId ?? null : null,
      extension: block.type === 'dialogue' ? block.extension ?? null : null,
      parenthetical: block.type === 'dialogue' ? block.parenthetical ?? null : null,
      lines: block.type === 'dialogue' ? stringifyArray(block.lines) : null,
      render: null,
      position: blockIndex,
    }).run();
    (block.castMemberIds ?? []).forEach((castMemberId, castIndex) => {
      session.db.insert(blockCastMembers).values({
        blockId: requiredId(block),
        castMemberId,
        position: castIndex,
      }).run();
    });
    (block.locationIds ?? []).forEach((locationId, locationIndex) => {
      session.db.insert(blockLocations).values({
        blockId: requiredId(block),
        locationId,
        position: locationIndex,
      }).run();
    });
  });
}

function deleteScreenplayTables(session: DatabaseSession): void {
  session.db.delete(blockCastMembers).run();
  session.db.delete(blockLocations).run();
  session.db.delete(sceneLocations).run();
  session.db.delete(blocks).run();
  session.db.delete(scenes).run();
  session.db.delete(sequences).run();
  session.db.delete(acts).run();
  session.db.delete(castMembers).run();
  session.db.delete(locations).run();
  session.db.delete(screenplay).run();
}

function assignCollectionIds<T extends { id?: string; localKey?: string }>(
  values: T[],
  prefix: EntityIdPrefix,
  path: string[],
  kind: string,
  localKeys: Map<string, string>,
  generatedIds: GeneratedId[],
  allocator: (prefix: EntityIdPrefix) => string,
  issues: DiagnosticIssue[]
): void {
  values.forEach((value, index) =>
    assignObjectId(value, prefix, [...path, String(index)], kind, localKeys, generatedIds, allocator, issues)
  );
}

function assignObjectId<T extends { id?: string; localKey?: string }>(
  value: T,
  prefix: EntityIdPrefix,
  path: string[],
  kind: string,
  localKeys: Map<string, string>,
  generatedIds: GeneratedId[],
  allocator: (prefix: EntityIdPrefix) => string,
  issues: DiagnosticIssue[]
): void {
  if (value.localKey) {
    if (localKeys.has(value.localKey)) {
      issues.push(createDiagnosticError('PROJECT_DATA209', `Duplicate localKey: ${value.localKey}.`, { path: [...path, 'localKey'] }, 'Use a unique request-local key.'));
      return;
    }
  }
  if (!value.id) {
    value.id = allocator(prefix);
    if (value.localKey) {
      generatedIds.push({ kind, path: [...path, 'localKey'], localKey: value.localKey, id: value.id });
    }
  }
  if (value.localKey) {
    localKeys.set(value.localKey, value.id);
  }
  delete value.localKey;
}

function resolveRefs(
  refs: Reference[] | undefined,
  durableIds: Set<string>,
  localKeys: Map<string, string>,
  path: string[],
  issues: DiagnosticIssue[],
  warnings: DiagnosticIssue[]
): string[] {
  const resolved: string[] = [];
  refs?.forEach((ref, index) => {
    const id = resolveRef(ref, durableIds, localKeys, [...path, String(index)], issues);
    if (id) {
      addUniqueResolvedId(resolved, id, [...path, String(index)], warnings);
    }
  });
  return resolved;
}

function addUniqueResolvedId(
  resolved: string[],
  id: string,
  path: string[],
  warnings: DiagnosticIssue[]
): void {
  if (!resolved.includes(id)) {
    resolved.push(id);
    return;
  }
  warnings.push(
    createDiagnosticWarning(
      'PROJECT_DATA215',
      `Duplicate relationship reference ignored: ${id}.`,
      { path },
      'Remove duplicate relationship references.'
    )
  );
}

function resolveRef(
  ref: Reference | undefined,
  durableIds: Set<string>,
  localKeys: Map<string, string>,
  path: string[],
  issues: DiagnosticIssue[]
): string | undefined {
  if (!ref || (ref.id && ref.localKey) || (!ref.id && !ref.localKey)) {
    issues.push(createDiagnosticError('PROJECT_DATA211', 'Reference must provide exactly one of id or localKey.', { path }, 'Provide exactly one of id or localKey.'));
    return undefined;
  }
  const id = ref.id ?? localKeys.get(ref.localKey ?? '');
  if (!id || !durableIds.has(id)) {
    issues.push(createDiagnosticError('PROJECT_DATA210', 'Reference points to an unknown object.', { path }, 'Reference an existing object id or define the target with localKey in this request.'));
    return undefined;
  }
  return id;
}

function throwValidation(issues: DiagnosticIssue[]): never {
  throw new ProjectDataError('PROJECT_DATA200', 'Screenplay JSON failed validation.', {
    issues,
    suggestion: 'Fix the reported screenplay issues and run the command again.',
  });
}

function requiredId(value: { id?: string }): string {
  if (!value.id) {
    throw new ProjectDataError('PROJECT_DATA219', 'A screenplay record was missing an allocated id.');
  }
  return value.id;
}

function stringifyArray(value: unknown[] | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}
