import { useRef, useState } from 'react';
import type {
  DialogueDirectionSession,
  DialogueDirectionTake,
  DialogueLineRange,
  ElevenV4DirectionInitial,
  ElevenV4VoiceSettings,
} from '@gorenku/studio-codex/dialogue-direction';
import { CharacterCount } from '../shared/character-count';
import { DialogueLineRail } from '../shared/dialogue-line-rail';
import { sameDialogueLineRange } from '../shared/dialogue-line-range';
import { DialogueTakeList } from '../shared/dialogue-take-list';
import type { DirectionEditorHandle } from '../shared/direction-editor';
import { DirectionPanelFrame } from '../shared/direction-panel-frame';
import { DirectionGenerateButton, DirectionSessionNotice, DirectionSessionPending } from '../shared/direction-session-notice';
import { directionSpeakers, linesInDialogueRange } from '../shared/direction-speakers';
import { useDialogueDirectionSession, type DialogueDirectionSessionInteraction } from '../shared/use-dialogue-direction-session';
import { useDirectionMediaLibrary, type DirectionMediaLibrary } from '../shared/use-direction-media';
import { DialogueDesk } from './dialogue-desk';
import { SingleLineDesk } from './single-line-desk';
import { VoiceSettingsControls } from './voice-settings-controls';

const ELEVEN_V4_DIALOGUE_CHARACTER_LIMIT = 2000;

export function ElevenV4DirectionPanel() {
  const interaction = useDialogueDirectionSession('Renku Eleven v4 dialogue direction');
  const media = useDirectionMediaLibrary(interaction.bridge);
  const { session } = interaction;
  if (!session) return <DirectionSessionPending error={interaction.error} />;
  if (session.initial.panel !== 'eleven-v4') return <DirectionSessionPending error='This session belongs to another dialogue direction panel.' />;
  return <ElevenV4DirectionDesk key={session.sessionId} session={session} initial={session.initial} interaction={interaction} media={media} />;
}

function ElevenV4DirectionDesk(input: {
  session: DialogueDirectionSession;
  initial: ElevenV4DirectionInitial;
  interaction: DialogueDirectionSessionInteraction;
  media: DirectionMediaLibrary;
}) {
  const { session, initial, interaction, media } = input;
  const [selection, setSelection] = useState<DialogueLineRange>(initial.selection);
  const [actingScripts, setActingScripts] = useState<Record<number, string>>(initial.actingScripts);
  const [castVoiceIds, setCastVoiceIds] = useState<Record<string, string>>(initial.voices);
  const [voiceSettings, setVoiceSettings] = useState<ElevenV4VoiceSettings>(initial.voiceSettings);
  const [focusedLine, setFocusedLine] = useState<number>();
  const editors = useRef(new Map<number, DirectionEditorHandle>());
  const singleEditor = useRef<DirectionEditorHandle>(null);

  const selectedLines = linesInDialogueRange(session.lines, selection);
  const speakers = directionSpeakers(selectedLines);
  const firstLine = session.lines[0];
  const lastLine = session.lines[session.lines.length - 1];
  const fullRange = firstLine && lastLine ? { start: firstLine.number, end: lastLine.number } : selection;
  const multiLine = selection.start !== selection.end;
  const totalCharacters = selectedLines.reduce((total, line) => total + (actingScripts[line.number] ?? '').length, 0);
  const generateDisabled = !interaction.connected || interaction.busy || interaction.actionActive;

  const setActingScript = (line: number, actingScript: string) => setActingScripts((current) => ({ ...current, [line]: actingScript }));
  const setCastVoiceId = (castMemberId: string, castVoiceId: string) => setCastVoiceIds((current) => ({ ...current, [castMemberId]: castVoiceId }));
  const generate = () => {
    if (generateDisabled) return;
    void interaction.generate({
      panel: 'eleven-v4',
      turnRange: selection,
      lines: selectedLines.map((line) => ({ number: line.number, actingScript: actingScripts[line.number] ?? '' })),
      voices: speakers.map((speaker) => ({ castMemberId: speaker.castMemberId, castVoiceId: castVoiceIds[speaker.castMemberId] ?? '' })),
      voiceSettings,
    });
  };
  const insertDialogueTag = (tag: string) => {
    const target = focusedLine !== undefined && editors.current.has(focusedLine) ? focusedLine : selectedLines[0]?.number;
    if (target !== undefined) editors.current.get(target)?.insertText(tag);
  };
  const editFromTake = (take: DialogueDirectionTake) => {
    if (take.actingScripts) setActingScripts((current) => ({ ...current, ...take.actingScripts }));
  };

  return (
    <DirectionPanelFrame
      shotPlan={session.shotPlan}
      modelLabel='Eleven v4'
      allLinesSelected={sameDialogueLineRange(selection, fullRange)}
      onSelectAll={() => setSelection(fullRange)}
      notice={<DirectionSessionNotice error={interaction.error} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />}
      rail={<DialogueLineRail lines={session.lines} takes={session.takes} selection={selection} media={media} onSelectionChange={setSelection} />}
    >
      {multiLine ? (
        <DialogueDesk
          lines={selectedLines}
          speakers={speakers}
          voices={session.voices}
          castVoiceIds={castVoiceIds}
          media={media}
          actingScripts={actingScripts}
          agentActingScripts={initial.actingScripts}
          suggestedTags={initial.suggestedTags}
          registerEditor={(line, handle) => { if (handle) editors.current.set(line, handle); else editors.current.delete(line); }}
          onEditorFocus={setFocusedLine}
          onCastVoiceChange={setCastVoiceId}
          onActingScriptChange={setActingScript}
          onRevert={(line) => setActingScript(line, initial.actingScripts[line] ?? '')}
          onInsertTag={insertDialogueTag}
          onGenerate={generate}
        />
      ) : selectedLines[0] ? (
        <SingleLineDesk
          line={selectedLines[0]}
          voices={selectedLines[0].castMemberId ? session.voices[selectedLines[0].castMemberId] ?? [] : []}
          castVoiceId={selectedLines[0].castMemberId ? castVoiceIds[selectedLines[0].castMemberId] : undefined}
          media={media}
          actingScript={actingScripts[selection.start] ?? ''}
          agentActingScript={initial.actingScripts[selection.start] ?? ''}
          suggestedTags={initial.suggestedTags}
          editorRef={singleEditor}
          onCastVoiceChange={(castVoiceId) => { if (selectedLines[0]?.castMemberId) setCastVoiceId(selectedLines[0].castMemberId, castVoiceId); }}
          onActingScriptChange={(actingScript) => setActingScript(selection.start, actingScript)}
          onRevert={() => setActingScript(selection.start, initial.actingScripts[selection.start] ?? '')}
          onInsertTag={(tag) => singleEditor.current?.insertText(tag)}
          onGenerate={generate}
        />
      ) : null}
      <div className='flex flex-wrap items-center gap-[22px]'>
        <VoiceSettingsControls voiceSettings={voiceSettings} onVoiceSettingsChange={setVoiceSettings} />
        {multiLine ? <CharacterCount count={totalCharacters} limit={ELEVEN_V4_DIALOGUE_CHARACTER_LIMIT} /> : null}
        <DirectionGenerateButton generating={interaction.actionActive} disabled={generateDisabled} onGenerate={generate} />
      </div>
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
