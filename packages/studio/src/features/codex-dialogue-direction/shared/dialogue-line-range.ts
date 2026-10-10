import type { DialogueLineRange } from '@gorenku/studio-codex/dialogue-direction';

export type DialogueLineGutterAction = 'add' | 'remove';

/**
 * Applies a shift-click or gutter adjustment to one continuous line selection.
 * Outside lines extend the range through them, edge lines are removed, and an
 * inner line trims the range back to it from the anchor line.
 */
export function adjustDialogueLineRange(selection: DialogueLineRange, anchor: number, line: number): DialogueLineRange {
  const { start, end } = selection;
  if (line < start || line > end) return { start: Math.min(line, start), end: Math.max(line, end) };
  if (start === end) return selection;
  if (line === start) return { start: start + 1, end };
  if (line === end) return { start, end: end - 1 };
  const origin = anchor >= start && anchor <= end ? anchor : start;
  return origin <= line ? { start: origin, end: line } : { start: line, end: origin };
}

export function dialogueLineGutterAction(selection: DialogueLineRange, line: number): DialogueLineGutterAction | null {
  if (line < selection.start || line > selection.end) return 'add';
  if (selection.start !== selection.end && (line === selection.start || line === selection.end)) return 'remove';
  return null;
}

export function dialogueLineRangeContains(range: DialogueLineRange, line: number): boolean {
  return line >= range.start && line <= range.end;
}

export function sameDialogueLineRange(left: DialogueLineRange, right: DialogueLineRange): boolean {
  return left.start === right.start && left.end === right.end;
}

export function dialogueLineRangeKey(range: DialogueLineRange): string {
  return `${range.start}-${range.end}`;
}
