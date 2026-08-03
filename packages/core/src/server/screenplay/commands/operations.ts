import type {
  Screenplay,
  ScreenplayOperation,
  ScreenplayOperationsInput,
  ScreenplayMutationReport,
  ScreenplayStructureEntry,
} from '../../../client/screenplay/index.js';
import { createRandomIdGenerator, type ProjectIdGenerator } from '../../entity-ids.js';
import { ProjectDataError } from '../../project-data-error.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { readScreenplayAggregate } from '../persistence/screenplay.js';
import { assertValidScreenplayOperations } from '../validation/blocks.js';
import { replaceScreenplayOpening } from './opening.js';
import { addScreenplayReference, deleteScreenplayReference } from './references.js';
import { addScreenplayScene, deleteScreenplayScene, updateScreenplayScene } from './scenes.js';
import {
  deleteSectionAndSpliceChildren,
  normalizePositions,
  placeStructureEntry,
} from './sections.js';
import {
  ScreenplayIdentityResolver,
  commitScreenplayMutation,
  preallocateOpeningInput,
  preallocateReferenceInput,
  preallocateSceneInput,
  preallocateSectionInput,
  resolveOpeningInput,
  resolveReferenceInput,
  resolveSceneInput,
  resolveSectionInput,
} from './screenplay.js';

export async function applyScreenplayOperations(
  input: RenkuConfigPathOptions & {
    projectName: string;
    operations: ScreenplayOperationsInput['operations'];
    idGenerator?: ProjectIdGenerator;
  },
): Promise<ScreenplayMutationReport> {
  assertValidScreenplayOperations({ operations: input.operations });
  const { session } = await openProjectSession(input);
  try {
    const screenplay = structuredClone(readScreenplayAggregate(session));
    const resolver = new ScreenplayIdentityResolver(
      input.idGenerator ?? createRandomIdGenerator(),
      screenplay,
    );
    const context: OperationContext = { screenplay, resolver };
    for (const operation of input.operations) {
      operationHandlers[operation.operation](context, operation as never);
    }
    normalizePositions(screenplay.structure);
    return commitScreenplayMutation({
      session,
      screenplay,
      resolver,
      sourceCommand: 'screenplay.apply',
    });
  } finally {
    session.close();
  }
}

interface OperationContext {
  screenplay: Screenplay;
  resolver: ScreenplayIdentityResolver;
}

type OperationName = ScreenplayOperation['operation'];
type OperationFor<TName extends OperationName> = Extract<
  ScreenplayOperation,
  { operation: TName }
>;
type OperationHandlerRegistry = {
  [TName in OperationName]: (
    context: OperationContext,
    operation: OperationFor<TName>,
  ) => void;
};

const operationHandlers: OperationHandlerRegistry = {
  'opening.replace': (context, operation) => {
    preallocateOpeningInput(context.resolver, operation.opening);
    replaceScreenplayOpening(
      context.screenplay,
      resolveOpeningInput(context.resolver, operation.opening),
    );
  },
  'scene.add': (context, operation) => {
    preallocateSceneInput(context.resolver, operation.scene, true, true);
    const scene = resolveSceneInput(context.resolver, operation.scene);
    addScreenplayScene(context.screenplay, scene);
    const entry: ScreenplayStructureEntry = {
      id: context.resolver.allocate(
        { key: operation.structureEntryKey },
        'structureEntry',
        'screenplay_structure_entry',
        true,
      ),
      content: { type: 'scene', sceneId: scene.id },
      position: 0,
    };
    placeStructureEntry({ ...context, entry, placement: operation.placement });
  },
  'scene.update': (context, operation) => {
    preallocateSceneInput(context.resolver, operation.scene, false);
    updateScreenplayScene(
      context.screenplay,
      resolveSceneInput(context.resolver, operation.scene),
    );
  },
  'scene.delete': (context, operation) => {
    deleteScreenplayScene(
      context.screenplay,
      context.resolver.reference(operation.scene),
    );
    normalizePositions(context.screenplay.structure);
  },
  'scene.move': (context, operation) => {
    const sceneId = context.resolver.reference(operation.scene);
    const entry = requireContentEntry(context.screenplay, 'scene', sceneId);
    placeStructureEntry({ ...context, entry, placement: operation.placement });
  },
  'section.add': (context, operation) => {
    preallocateSectionInput(context.resolver, operation.section, true);
    const section = resolveSectionInput(context.resolver, operation.section);
    context.screenplay.sections.push(section);
    const entry: ScreenplayStructureEntry = {
      id: context.resolver.allocate(
        { key: operation.structureEntryKey },
        'structureEntry',
        'screenplay_structure_entry',
        true,
      ),
      content: { type: 'section', sectionId: section.id },
      position: 0,
    };
    placeStructureEntry({ ...context, entry, placement: operation.placement });
  },
  'section.update': (context, operation) => {
    preallocateSectionInput(context.resolver, operation.section, false);
    const section = resolveSectionInput(context.resolver, operation.section);
    const index = context.screenplay.sections.findIndex((value) => value.id === section.id);
    if (index < 0) {
      requireContentEntry(context.screenplay, 'section', section.id);
    }
    context.screenplay.sections[index] = section;
  },
  'section.delete': (context, operation) => {
    deleteSectionAndSpliceChildren(
      context.screenplay,
      context.resolver.reference(operation.section),
    );
  },
  'section.move': (context, operation) => {
    const sectionId = context.resolver.reference(operation.section);
    const entry = requireContentEntry(context.screenplay, 'section', sectionId);
    placeStructureEntry({ ...context, entry, placement: operation.placement });
  },
  'reference.add': (context, operation) => {
    preallocateReferenceInput(context.resolver, operation.reference, true);
    addScreenplayReference(
      context.screenplay,
      resolveReferenceInput(context.resolver, operation.reference),
    );
  },
  'reference.delete': (context, operation) => {
    deleteScreenplayReference(
      context.screenplay,
      context.resolver.reference(operation.reference),
    );
  },
};

function requireContentEntry(
  screenplay: Screenplay,
  type: 'scene' | 'section',
  id: string,
): ScreenplayStructureEntry {
  const entry = screenplay.structure.find((candidate) =>
    candidate.content.type === type
      && (type === 'scene'
        ? candidate.content.type === 'scene' && candidate.content.sceneId === id
        : candidate.content.type === 'section' && candidate.content.sectionId === id)
  );
  if (!entry) {
    throw new ProjectDataError(
      'SCREENPLAY_STRUCTURE_ENTRY_NOT_FOUND',
      `Screenplay ${type} structure entry was not found: ${id}.`,
      { suggestion: 'Use an ID from the current Screenplay structure resource.' },
    );
  }
  return entry;
}
