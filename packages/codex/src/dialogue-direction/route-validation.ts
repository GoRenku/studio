import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { isJsonPointer } from '../native-request-controls/json-pointer.js';
import { panelControlIssues } from '../panel-sessions/panel-controls.js';
import type { DialogueDirectionOperation, DialogueDirectionRoute, DialogueDirectionScriptLayout, DialogueDirectionScriptLocation } from './contracts.js';
import { directionIssue } from './diagnostics.js';

type OperationName = keyof DialogueDirectionRoute['operations'];
type Path = Array<string | number>;

/** The Script Location kind each layout's operations must declare. */
const SCRIPT_LOCATION_KINDS: Record<DialogueDirectionScriptLayout, Record<OperationName, DialogueDirectionScriptLocation['kind']>> = {
  'line-scripts': { singleLine: 'text', lineRange: 'line-list' },
  'range-prompt': { singleLine: 'text', lineRange: 'text' },
};

/** Consistency of a Skill-supplied Route Description, collected. Never reads provider or model ids. */
export function directionRouteIssues(route: DialogueDirectionRoute): DiagnosticIssue[] {
  return [
    ...mentionIssues(route),
    ...operationIssues(route, 'singleLine', route.operations.singleLine),
    ...(route.operations.lineRange ? operationIssues(route, 'lineRange', route.operations.lineRange) : []),
  ];
}

function mentionIssues(route: DialogueDirectionRoute): DiagnosticIssue[] {
  if (route.voiceBinding.kind !== 'voice-references' || route.voiceBinding.mentions === null) return [];
  const { mentions } = route.voiceBinding;
  const path = ['route', 'voiceBinding', 'mentions'];
  return [
    ...(mentions.length === route.maxVoices ? [] : [directionIssue(path, `Voice Mentions must list exactly ${route.maxVoices} entries, one per reference position.`)]),
    ...mentions.filter((mention, index) => mentions.indexOf(mention) !== index).map((mention) => directionIssue(path, `Voice Mention ${mention} is listed more than once.`)),
  ];
}

function operationIssues(route: DialogueDirectionRoute, name: OperationName, operation: DialogueDirectionOperation): DiagnosticIssue[] {
  const path = ['route', 'operations', name];
  return [
    ...panelControlIssues(operation.controls, directionIssue, [...path, 'controls']),
    ...(operation.scriptLocation ? scriptLocationIssues(operation.scriptLocation, SCRIPT_LOCATION_KINDS[route.scriptLayout][name], [...path, 'scriptLocation']) : []),
  ];
}

function scriptLocationIssues(location: DialogueDirectionScriptLocation, expectedKind: DialogueDirectionScriptLocation['kind'], path: Path): DiagnosticIssue[] {
  if (location.kind !== expectedKind) return [directionIssue([...path, 'kind'], `This layout keeps this operation's direction in a ${expectedKind} Script Location.`)];
  const pointers = location.kind === 'text' ? { pointer: location.pointer } : { listPointer: location.listPointer, textPointer: location.textPointer };
  return Object.entries(pointers)
    .filter(([, pointer]) => !isJsonPointer(pointer))
    .map(([field, pointer]) => directionIssue([...path, field], `${pointer} is not a JSON Pointer.`));
}
