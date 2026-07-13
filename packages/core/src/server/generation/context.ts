import type {
  GenerationContext,
  GenerationReferenceGuide,
  GenerationPurposeSettings,
  GenerationModelDescriptor,
  GenerationTarget,
  JsonValue,
} from '../../client/generation.js';
import { ProjectDataError } from '../project-data-error.js';
import type { GenerationPurposeContract } from './purpose-contract.js';

export function buildGenerationContext(input: {
  purpose: GenerationPurposeContract;
  target: GenerationTarget;
  facts: Record<string, JsonValue>;
  referenceGuide: GenerationReferenceGuide;
  settings: GenerationPurposeSettings;
  models: GenerationModelDescriptor[];
}): GenerationContext {
  if (input.target.kind !== input.purpose.targetKind) {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_INVALID',
      `Generation purpose ${input.purpose.purpose} requires target kind ${input.purpose.targetKind}, received ${input.target.kind}.`
    );
  }
  assertReferenceGuideStructure(input.referenceGuide);
  return {
    purpose: input.purpose.purpose,
    target: input.target,
    outputMediaKind: input.purpose.outputMediaKind,
    facts: input.facts,
    settings: input.settings,
    models: input.models,
    referenceGuide: input.referenceGuide,
  };
}

function assertReferenceGuideStructure(guide: GenerationReferenceGuide): void {
  const sectionIds = new Set<string>();
  for (const section of guide.sections) {
    const sectionKey = [
      section.id,
      section.scope?.kind ?? '',
      section.scope?.id ?? '',
    ].join('\0');
    if (!section.id || sectionIds.has(sectionKey)) {
      throw new ProjectDataError(
        'CORE_GENERATION_GUIDE_INVALID',
        `Generation reference guide section ids must be non-empty and unique: ${section.id}.`
      );
    }
    sectionIds.add(sectionKey);
    const slotKeys = new Set<string>();
    for (const slot of section.slots) {
      const subjectKey = slot.subject
        ? `${slot.subject.kind}:${slot.subject.id}`
        : '';
      const scopeKey = section.scope
        ? `${section.scope.kind}:${section.scope.id}`
        : '';
      const slotKey = `${scopeKey}\0${slot.id}\0${subjectKey}`;
      if (!slot.id || slotKeys.has(slotKey)) {
        throw new ProjectDataError(
          'CORE_GENERATION_GUIDE_INVALID',
          `Generation reference guide slot placements must be non-empty and unique within section ${section.id}: ${slot.id}.`
        );
      }
      slotKeys.add(slotKey);
    }
  }
}
