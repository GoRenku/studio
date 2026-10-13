import { useState } from 'react';
import type { DialogueDirectionDraft, DialogueDirectionRoute, DialogueDirectionSession, DialogueLineRange } from '@gorenku/studio-codex/dialogue-direction';
import type { JsonValue } from '@gorenku/studio-core/client';
import { initialNativeRequestValues } from '@/features/codex-panels/native-request-values';
import { sameDialogueLineRange } from './dialogue-line-range';
import { directionSpeakers, linesInDialogueRange } from './direction-speakers';
import type { DialogueDirectionSessionInteraction } from './use-dialogue-direction-session';

type OperationName = keyof DialogueDirectionRoute['operations'];

/** Selection, voices and native values shared by both layout desks; the desk owns its Direction Scripts. */
export function useDirectionDesk(session: DialogueDirectionSession, interaction: DialogueDirectionSessionInteraction) {
  const { route } = session;
  const [selection, setSelection] = useState<DialogueLineRange>(session.initial.selection);
  const [castVoiceIds, setCastVoiceIds] = useState<Record<string, string>>(session.initial.voices);
  const [values, setValues] = useState<Record<OperationName, Record<string, JsonValue>>>(() => ({
    singleLine: initialNativeRequestValues(route.operations.singleLine.controls),
    lineRange: route.operations.lineRange ? initialNativeRequestValues(route.operations.lineRange.controls) : {},
  }));

  const operationName: OperationName = selection.start === selection.end ? 'singleLine' : 'lineRange';
  const operation = route.operations[operationName] ?? route.operations.singleLine;
  const selectedLines = linesInDialogueRange(session.lines, selection);
  const speakers = directionSpeakers(selectedLines);
  const firstLine = session.lines[0];
  const lastLine = session.lines[session.lines.length - 1];
  const fullRange = firstLine && lastLine ? { start: firstLine.number, end: lastLine.number } : selection;
  const generateDisabled = !interaction.connected || interaction.busy || interaction.actionActive || speakers.length > route.maxVoices;

  return {
    selection,
    setSelection,
    selectedLines,
    speakers,
    castVoiceIds,
    setCastVoiceId: (castMemberId: string, castVoiceId: string) => setCastVoiceIds((current) => ({ ...current, [castMemberId]: castVoiceId })),
    operation,
    values: values[operationName],
    setValue: (key: string, value: JsonValue) => setValues((current) => ({ ...current, [operationName]: { ...current[operationName], [key]: value } })),
    fullRange,
    /** False when the route directs one line per Take. */
    rangeSelectable: route.operations.lineRange !== null,
    allLinesSelected: sameDialogueLineRange(selection, fullRange),
    generateDisabled,
    generate: (scripts: DialogueDirectionDraft['scripts']) => {
      if (generateDisabled) return;
      void interaction.generate({
        turnRange: selection,
        scripts,
        voices: speakers.map((speaker) => ({ castMemberId: speaker.castMemberId, castVoiceId: castVoiceIds[speaker.castMemberId] ?? '' })),
        values: values[operationName],
      });
    },
  };
}
