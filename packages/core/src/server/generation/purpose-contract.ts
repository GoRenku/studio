import type {
  GenerationContext,
  GenerationGuideNotice,
  GenerationOutputMediaKind,
  GenerationPurpose,
  GenerationPurposeSettings,
  GenerationReferenceGuide,
  GenerationSpecAuthoredFrom,
  GenerationTarget,
  JsonValue,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export interface BuildGenerationPurposeInput {
  target: GenerationTarget;
  session: DatabaseSession;
  projectFolder: string;
  facts?: Record<string, JsonValue>;
  authoredFrom?: GenerationSpecAuthoredFrom;
  guideNotices?: GenerationGuideNotice[];
}

export interface GenerationPurposeDescriptor {
  purpose: GenerationPurpose;
  targetKind: GenerationTarget['kind'];
  outputMediaKind: GenerationOutputMediaKind;
  settings: GenerationPurposeSettings;
  buildReferenceGuide(input: BuildGenerationPurposeInput): Promise<GenerationReferenceGuide>;
  buildContext(input: BuildGenerationPurposeInput): Promise<GenerationContext>;
}

export type GenerationPurposeContract = Pick<
  GenerationPurposeDescriptor,
  'purpose' | 'targetKind' | 'outputMediaKind'
>;
