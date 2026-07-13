import type {
  GenerationContext,
  GenerationOutputMediaKind,
  GenerationPurpose,
  GenerationPurposeSettings,
  GenerationReferenceGuide,
  GenerationTarget,
  JsonValue,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export interface BuildGenerationPurposeInput {
  target: GenerationTarget;
  session: DatabaseSession;
  projectFolder: string;
  facts?: Record<string, JsonValue>;
}

export interface GenerationPurposeDescriptor {
  purpose: GenerationPurpose;
  targetKind: GenerationTarget['kind'];
  outputMediaKind: GenerationOutputMediaKind;
  modelUse: 'create' | 'edit' | 'any';
  settings: GenerationPurposeSettings;
  buildReferenceGuide(input: BuildGenerationPurposeInput): Promise<GenerationReferenceGuide>;
  buildContext(input: BuildGenerationPurposeInput): Promise<GenerationContext>;
}

export type GenerationPurposeContract = Pick<
  GenerationPurposeDescriptor,
  'purpose' | 'targetKind' | 'outputMediaKind'
>;

export type GenerationPurposeEditingContract = Pick<
  GenerationPurposeDescriptor,
  'purpose' | 'targetKind' | 'outputMediaKind'
> & { referenceGuide: GenerationReferenceGuide };
