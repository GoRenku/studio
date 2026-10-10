import type {
  JsonValue,
  ProviderExecutionContext,
  ProviderExecutionResult,
} from '../../../media/contracts.js';
import { EngineError } from '../../../shared/errors.js';
import { elevenLabsDialogueOperation } from './dialogue.js';
import { elevenLabsMusicOperation } from './music.js';
import { elevenLabsSpeechOperation } from './speech.js';
import { elevenLabsVoiceSampleOperation } from './voice-sample.js';

export type ElevenLabsOperationKind = 'speech' | 'dialogue' | 'music' | 'voice-sample';

export interface ElevenLabsOperationTarget {
  /** Route id received as `request.model`; reported as the result model. */
  model: string;
  /** ElevenLabs model id sent to the provider API. */
  modelId: string;
}

export interface ElevenLabsOperation {
  readonly inputSchema?: JsonValue;
  validate(input: Record<string, JsonValue>, target: ElevenLabsOperationTarget): void;
  execute(
    input: Record<string, JsonValue>,
    target: ElevenLabsOperationTarget,
    context: ProviderExecutionContext,
  ): Promise<ProviderExecutionResult>;
}

export interface ResolvedElevenLabsOperation {
  kind: ElevenLabsOperationKind;
  target: ElevenLabsOperationTarget;
  operation: ElevenLabsOperation;
}

const DIALOGUE_ROUTE_SUFFIX = '/text-to-dialogue';

const FIXED_ROUTE_OPERATIONS: Readonly<Record<string, {
  kind: ElevenLabsOperationKind;
  operation: ElevenLabsOperation;
}>> = {
  'voice-sample-audio': { kind: 'voice-sample', operation: elevenLabsVoiceSampleOperation },
  music_v1: { kind: 'music', operation: elevenLabsMusicOperation },
};

export function resolveElevenLabsOperation(model: string): ResolvedElevenLabsOperation {
  if (Object.hasOwn(FIXED_ROUTE_OPERATIONS, model)) {
    const fixed = FIXED_ROUTE_OPERATIONS[model];
    return { ...fixed, target: { model, modelId: model } };
  }
  if (model.endsWith(DIALOGUE_ROUTE_SUFFIX)) {
    const modelId = model.slice(0, -DIALOGUE_ROUTE_SUFFIX.length);
    if (modelId.trim().length === 0) {
      throw new EngineError(
        'ENGINE_REQUEST_INVALID',
        `ElevenLabs dialogue route "${model}" must name a model before "${DIALOGUE_ROUTE_SUFFIX}".`,
        { provider: 'elevenlabs', model },
      );
    }
    return {
      kind: 'dialogue',
      operation: elevenLabsDialogueOperation,
      target: { model, modelId },
    };
  }
  return {
    kind: 'speech',
    operation: elevenLabsSpeechOperation,
    target: { model, modelId: model },
  };
}
