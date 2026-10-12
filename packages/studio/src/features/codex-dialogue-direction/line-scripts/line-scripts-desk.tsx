import { useRef, useState } from 'react';
import type { DialogueDirectionTake } from '@gorenku/studio-codex/dialogue-direction';
import { CodexPanelNotice } from '@/features/codex-panels/codex-panel-notice';
import { DialogueLineRail } from '../shared/dialogue-line-rail';
import { DialogueTakeList } from '../shared/dialogue-take-list';
import type { DirectionDeskProps } from '../shared/direction-desk-props';
import type { DirectionEditorHandle } from '../shared/direction-editor';
import { directionEmphasisHighlight } from '../shared/direction-emphasis';
import { DirectionGenerateRow } from '../shared/direction-generate-row';
import { DirectionPanelFrame } from '../shared/direction-panel-frame';
import { SpeakerVoiceRow } from '../shared/speaker-voice-row';
import { useDirectionDesk } from '../shared/use-direction-desk';
import { directionMentionColours, voiceReferenceBadge } from '../shared/voice-references';
import { MultiLineScriptEditor } from './multi-line-script-editor';
import { SingleLineScriptEditor } from './single-line-script-editor';

/** Line Scripts: one Direction Script per screenplay line. */
export function LineScriptsDesk({ session, interaction, media }: DirectionDeskProps) {
  const { route, initial } = session;
  const desk = useDirectionDesk(session, interaction);
  const agentScripts = Object.fromEntries(initial.scripts.map((script) => [script.turnRange.start, script.text]));
  const [scripts, setScripts] = useState<Record<number, string>>(agentScripts);
  const [focusedLine, setFocusedLine] = useState<number>();
  const editors = useRef(new Map<number, DirectionEditorHandle>());
  const singleEditor = useRef<DirectionEditorHandle>(null);

  const { selection, selectedLines, speakers } = desk;
  const multiLine = selection.start !== selection.end;
  const highlight = directionEmphasisHighlight(route.emphasis, directionMentionColours(route, speakers));
  const setScript = (line: number, script: string) => setScripts((current) => ({ ...current, [line]: script }));
  const generate = () => desk.generate(selectedLines.map((line) => ({ turnRange: { start: line.number, end: line.number }, text: scripts[line.number] ?? '' })));
  const focusedEditor = () => (multiLine
    ? editors.current.get(focusedLine !== undefined && editors.current.has(focusedLine) ? focusedLine : selectedLines[0]?.number ?? -1)
    : singleEditor.current);
  const insertText = (text: string) => focusedEditor()?.insertText(text);
  const editFromTake = (take: DialogueDirectionTake) => {
    if (take.scripts) setScripts((current) => ({ ...current, ...Object.fromEntries(take.scripts!.map((script) => [script.turnRange.start, script.text])) }));
  };

  return (
    <DirectionPanelFrame
      shotPlan={session.shotPlan}
      routeLabel={`${route.label} · ${route.providerLabel}`}
      allLinesSelected={desk.allLinesSelected}
      onSelectAll={desk.rangeSelectable ? () => desk.setSelection(desk.fullRange) : undefined}
      notice={<CodexPanelNotice error={interaction.error} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />}
      rail={<DialogueLineRail lines={session.lines} takes={session.takes} selection={selection} media={media} rangeSelectable={desk.rangeSelectable} speakerBadge={(line) => voiceReferenceBadge(route, speakers, line.castMemberId)} onSelectionChange={desk.setSelection} />}
    >
      <SpeakerVoiceRow route={route} speakers={speakers} voices={session.voices} castVoiceIds={desk.castVoiceIds} media={media} onInsertMention={insertText} onCastVoiceChange={desk.setCastVoiceId} />
      {multiLine ? (
        <MultiLineScriptEditor
          lines={selectedLines}
          media={media}
          scripts={scripts}
          agentScripts={agentScripts}
          highlight={highlight}
          suggestedTags={initial.suggestedTags}
          registerEditor={(line, handle) => { if (handle) editors.current.set(line, handle); else editors.current.delete(line); }}
          onEditorFocus={setFocusedLine}
          onScriptChange={setScript}
          onRevert={(line) => setScript(line, agentScripts[line] ?? '')}
          onInsertTag={insertText}
          onGenerate={generate}
        />
      ) : selectedLines[0] ? (
        <SingleLineScriptEditor
          line={selectedLines[0]}
          script={scripts[selection.start] ?? ''}
          agentScript={agentScripts[selection.start] ?? ''}
          highlight={highlight}
          suggestedTags={initial.suggestedTags}
          editorRef={singleEditor}
          onScriptChange={(script) => setScript(selection.start, script)}
          onRevert={() => setScript(selection.start, agentScripts[selection.start] ?? '')}
          onInsertTag={insertText}
          onGenerate={generate}
        />
      ) : null}
      <DirectionGenerateRow
        route={route}
        operation={desk.operation}
        values={desk.values}
        characterCount={selectedLines.reduce((total, line) => total + (scripts[line.number] ?? '').length, 0)}
        generating={interaction.actionActive}
        disabled={desk.generateDisabled}
        onValueChange={desk.setValue}
        onGenerate={generate}
      />
      <DialogueTakeList
        takes={session.takes}
        selection={selection}
        action={session.action}
        media={media}
        autoPlayTakeId={interaction.autoPlayTakeId}
        disabled={!interaction.connected || interaction.busy}
        onSelect={(takeId, selected) => { void interaction.selectTake(takeId, selected); }}
        onDiscard={(takeId) => { void interaction.discardTake(takeId); }}
        onEditFromTake={editFromTake}
      />
    </DirectionPanelFrame>
  );
}
