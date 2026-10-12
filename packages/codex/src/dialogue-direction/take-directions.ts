import type { ShotPlanDialogueAudioTake } from '@gorenku/studio-core/client';
import { readJsonPointer } from '../native-request-controls/json-pointer.js';
import type { DialogueDirectionRoute, DialogueDirectionScript, DialogueDirectionScriptLocation, DialogueLineRange } from './contracts.js';
import { operationForRange } from './draft-validation.js';

/** Provenance provider is the route's provider and provenance model is one of its operation models. */
export function takeMatchesRoute(take: ShotPlanDialogueAudioTake, route: DialogueDirectionRoute): boolean {
  const provenance = take.assetFile.generationProvenance;
  const models = [route.operations.singleLine.model, ...(route.operations.lineRange ? [route.operations.lineRange.model] : [])];
  return provenance?.provider === route.provider && models.includes(provenance.model);
}

/** Reads a route Take's Direction Scripts through the declared Script Location of the operation that made it. */
export function takeDirectionScripts(take: ShotPlanDialogueAudioTake, route: DialogueDirectionRoute): DialogueDirectionScript[] | null {
  const provenance = take.assetFile.generationProvenance;
  const operation = operationForRange(route, take.turnRange);
  if (!provenance || provenance.provider !== route.provider || operation?.model !== provenance.model || !operation.scriptLocation) return null;
  return SCRIPT_READERS[operation.scriptLocation.kind](provenance.request, operation.scriptLocation as never, take.turnRange);
}

type ScriptReader<TLocation extends DialogueDirectionScriptLocation> = (request: unknown, location: TLocation, range: DialogueLineRange) => DialogueDirectionScript[] | null;

const SCRIPT_READERS: { [Kind in DialogueDirectionScriptLocation['kind']]: ScriptReader<Extract<DialogueDirectionScriptLocation, { kind: Kind }>> } = {
  text: (request, location, range) => {
    const text = readJsonPointer(request as never, location.pointer);
    return typeof text === 'string' ? [{ turnRange: { ...range }, text }] : null;
  },
  'line-list': (request, location, range) => {
    const list = readJsonPointer(request as never, location.listPointer);
    if (!Array.isArray(list) || list.length !== range.end - range.start + 1) return null;
    const texts = list.map((entry) => readJsonPointer(entry, location.textPointer));
    if (texts.some((text) => typeof text !== 'string')) return null;
    return texts.map((text, index) => ({ turnRange: { start: range.start + index, end: range.start + index }, text: text as string }));
  },
};
