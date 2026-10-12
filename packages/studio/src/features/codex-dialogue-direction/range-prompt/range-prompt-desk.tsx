import { useRef, useState } from 'react';
import type { DialogueDirectionTake, DialogueLineRange } from '@gorenku/studio-codex/dialogue-direction';
import { CodexPanelNotice } from '@/features/codex-panels/codex-panel-notice';
import { DialogueLineRail } from '../shared/dialogue-line-rail';
import { dialogueLineRangeKey } from '../shared/dialogue-line-range';
import { DialogueTakeList } from '../shared/dialogue-take-list';
import type { DirectionDeskProps } from '../shared/direction-desk-props';
import { DirectionEditor, type DirectionEditorHandle } from '../shared/direction-editor';
import { directionEmphasisHighlight } from '../shared/direction-emphasis';
import { DirectionGenerateRow } from '../shared/direction-generate-row';
import { DirectionPanelFrame } from '../shared/direction-panel-frame';
import { DirectionRevertButton } from '../shared/direction-revert-button';
import { SpeakerVoiceRow } from '../shared/speaker-voice-row';
import { SuggestedTagChips } from '../shared/suggested-tag-chips';
import { useDirectionDesk } from '../shared/use-direction-desk';
import { directionMentionColours, voiceReferenceBadge } from '../shared/voice-references';

/** Range Prompt: one Direction Script for the selected line range. */
export function RangePromptDesk({ session, interaction, media }: DirectionDeskProps) {
  const { route, initial } = session;
  const desk = useDirectionDesk(session, interaction);
  const agentPrompts = Object.fromEntries(initial.scripts.map((script) => [dialogueLineRangeKey(script.turnRange), script.text]));
  const [prompts, setPrompts] = useState<Record<string, string>>(agentPrompts);
  const editor = useRef<DirectionEditorHandle>(null);

  const { selection, selectedLines, speakers } = desk;
  const selectionKey = dialogueLineRangeKey(selection);
  const prompt = prompts[selectionKey] ?? '';
  const agentPrompt = agentPrompts[selectionKey];
  const highlight = directionEmphasisHighlight(route.emphasis, directionMentionColours(route, speakers));

  const changeSelection = (next: DialogueLineRange) => {
    const nextKey = dialogueLineRangeKey(next);
    setPrompts((current) => (current[nextKey] === undefined ? { ...current, [nextKey]: prompt } : current));
    desk.setSelection(next);
  };
  const setPrompt = (next: string) => setPrompts((current) => ({ ...current, [selectionKey]: next }));
  const generate = () => desk.generate([{ turnRange: selection, text: prompt }]);
  const insertText = (text: string) => editor.current?.insertText(text);
  const editFromTake = (take: DialogueDirectionTake) => {
    const script = take.scripts?.[0];
    if (script) setPrompts((current) => ({ ...current, [dialogueLineRangeKey(take.turnRange)]: script.text }));
  };

  return (
    <DirectionPanelFrame
      shotPlan={session.shotPlan}
      routeLabel={`${route.label} · ${route.providerLabel}`}
      allLinesSelected={desk.allLinesSelected}
      onSelectAll={desk.rangeSelectable ? () => changeSelection(desk.fullRange) : undefined}
      notice={<CodexPanelNotice error={interaction.error} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />}
      rail={<DialogueLineRail lines={session.lines} takes={session.takes} selection={selection} media={media} rangeSelectable={desk.rangeSelectable} speakerBadge={(line) => voiceReferenceBadge(route, speakers, line.castMemberId)} onSelectionChange={changeSelection} />}
    >
      <SpeakerVoiceRow route={route} speakers={speakers} voices={session.voices} castVoiceIds={desk.castVoiceIds} media={media} onInsertMention={insertText} onCastVoiceChange={desk.setCastVoiceId} />
      <div className='flex max-w-[44em] flex-col gap-2'>
        {selectedLines.map((line) => (
          <div key={line.number} className='grid grid-cols-[110px_minmax(0,1fr)] gap-3 font-[family-name:var(--dd-font-script)] text-sm leading-[1.45] text-[var(--dd-card-fg)]'>
            <span className='pt-0.5 text-xs uppercase tracking-[0.02em] text-[var(--dd-muted-fg)]'>{line.speakerName}</span>
            <span>{line.plainText}</span>
          </div>
        ))}
      </div>
      <DirectionEditor
        value={prompt}
        onValueChange={setPrompt}
        highlight={highlight}
        size='prompt'
        ariaLabel='Direction for the selected lines'
        handleRef={editor}
        onGenerate={generate}
        footer={<>
          <SuggestedTagChips tags={initial.suggestedTags} onInsert={insertText} />
          <span className='flex-1' />
          {agentPrompt !== undefined && prompt !== agentPrompt ? <DirectionRevertButton onRevert={() => setPrompt(agentPrompt)} /> : null}
        </>}
      />
      <DirectionGenerateRow
        route={route}
        operation={desk.operation}
        values={desk.values}
        characterCount={prompt.length}
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
