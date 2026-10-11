import { useRef, useState } from 'react';
import type {
  DialogueDirectionLine,
  DialogueDirectionSession,
  DialogueLineRange,
  SeedAudioDirectionInitial,
} from '@gorenku/studio-codex/dialogue-direction';
import { CharacterCount } from '../shared/character-count';
import { DialogueLineRail } from '../shared/dialogue-line-rail';
import { DirectionGenerateDisclosure } from '../shared/direction-generate-disclosure';
import { directionProviderLabel } from '../shared/direction-provider-label';
import { dialogueLineRangeKey, sameDialogueLineRange } from '../shared/dialogue-line-range';
import { DialogueTakeList } from '../shared/dialogue-take-list';
import { DirectionEditor, type DirectionEditorHandle } from '../shared/direction-editor';
import { DirectionPanelFrame } from '../shared/direction-panel-frame';
import { DirectionRevertButton } from '../shared/direction-revert-button';
import { CodexPanelGenerateButton, CodexPanelNotice, CodexPanelPending } from '@/features/codex-panels/codex-panel-notice';
import { directionSpeakers, linesInDialogueRange } from '../shared/direction-speakers';
import { speakerHue, speakerTextColour } from '../shared/speaker-colour';
import { useDialogueDirectionSession, type DialogueDirectionSessionInteraction } from '../shared/use-dialogue-direction-session';
import { usePanelMediaLibrary, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { performancePromptHighlight } from './performance-prompt-highlight';
import { SEED_AUDIO_VOICE_REFERENCE_LIMIT, SeedAudioVoiceReferences } from './seed-audio-voice-references';

const SEED_AUDIO_PROMPT_CHARACTER_LIMIT = 2048;

export function SeedAudioDirectionPanel() {
  const interaction = useDialogueDirectionSession('Renku Seed Audio dialogue direction');
  const media = usePanelMediaLibrary(interaction.bridge);
  const { session } = interaction;
  if (!session) return <CodexPanelPending error={interaction.error} label='dialogue direction' themeClass='dialogue-direction' />;
  if (session.initial.panel !== 'seed-audio') return <CodexPanelPending error='This session belongs to another dialogue direction panel.' label='dialogue direction' themeClass='dialogue-direction' />;
  return <SeedAudioDirectionDesk key={session.sessionId} session={session} initial={session.initial} interaction={interaction} media={media} />;
}

function SeedAudioDirectionDesk(input: {
  session: DialogueDirectionSession;
  initial: SeedAudioDirectionInitial;
  interaction: DialogueDirectionSessionInteraction;
  media: PanelMediaLibrary;
}) {
  const { session, initial, interaction, media } = input;
  const [selection, setSelection] = useState<DialogueLineRange>(initial.selection);
  const [prompts, setPrompts] = useState<Record<string, string>>(() => Object.fromEntries(initial.prompts.map((draft) => [dialogueLineRangeKey(draft.turnRange), draft.prompt])));
  const [castVoiceIds, setCastVoiceIds] = useState<Record<string, string>>(initial.voices);
  const editor = useRef<DirectionEditorHandle>(null);

  const selectionKey = dialogueLineRangeKey(selection);
  const prompt = prompts[selectionKey] ?? '';
  const agentPrompt = initial.prompts.find((draft) => sameDialogueLineRange(draft.turnRange, selection))?.prompt;
  const selectedLines = linesInDialogueRange(session.lines, selection);
  const speakers = directionSpeakers(selectedLines);
  const tooManySpeakers = speakers.length > SEED_AUDIO_VOICE_REFERENCE_LIMIT;
  const insertsAudioTags = initial.promptMentions === 'audio-tags';
  const firstLine = session.lines[0];
  const lastLine = session.lines[session.lines.length - 1];
  const fullRange = firstLine && lastLine ? { start: firstLine.number, end: lastLine.number } : selection;
  const generateDisabled = !interaction.connected || interaction.busy || interaction.actionActive || tooManySpeakers;

  const highlight = performancePromptHighlight(insertsAudioTags && !tooManySpeakers
    ? speakers.map((speaker) => speakerTextColour(speakerHue(speaker.castMemberId, speaker.speakerName)))
    : null);

  const changeSelection = (next: DialogueLineRange) => {
    const nextKey = dialogueLineRangeKey(next);
    setPrompts((current) => (current[nextKey] === undefined ? { ...current, [nextKey]: prompt } : current));
    setSelection(next);
  };
  const setPrompt = (next: string) => setPrompts((current) => ({ ...current, [selectionKey]: next }));
  const speakerBadge = (line: DialogueDirectionLine) => {
    const index = speakers.findIndex((speaker) => speaker.castMemberId === line.castMemberId);
    return index >= 0 && index < SEED_AUDIO_VOICE_REFERENCE_LIMIT ? index + 1 : null;
  };
  const provider = directionProviderLabel(session.route.provider);
  const generate = () => {
    if (generateDisabled) return;
    void interaction.generate({
      panel: 'seed-audio',
      turnRange: selection,
      prompt,
      voiceReferences: speakers.map((speaker, index) => ({
        position: (index + 1) as 1 | 2 | 3,
        castMemberId: speaker.castMemberId,
        castVoiceId: castVoiceIds[speaker.castMemberId] ?? '',
      })),
    }, `I approve uploading the chosen voice samples and this performance prompt to ${provider} and running one paid Seed Audio 1.0 generation with my saved ${provider} key.`);
  };

  return (
    <DirectionPanelFrame
      shotPlan={session.shotPlan}
      modelLabel='Seed Audio 1.0'
      allLinesSelected={sameDialogueLineRange(selection, fullRange)}
      onSelectAll={() => changeSelection(fullRange)}
      notice={<CodexPanelNotice error={interaction.error} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />}
      rail={<DialogueLineRail lines={session.lines} takes={session.takes} selection={selection} media={media} speakerBadge={speakerBadge} onSelectionChange={changeSelection} />}
    >
      <SeedAudioVoiceReferences
        speakers={speakers}
        voices={session.voices}
        castVoiceIds={castVoiceIds}
        media={media}
        insertsAudioTags={insertsAudioTags}
        onInsertAudioTag={(position) => editor.current?.insertText(`@Audio${position}`)}
        onCastVoiceChange={(castMemberId, castVoiceId) => setCastVoiceIds((current) => ({ ...current, [castMemberId]: castVoiceId }))}
      />
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
        ariaLabel='Performance prompt'
        handleRef={editor}
        onGenerate={generate}
        footer={<>
          <span className='flex-1' />
          {agentPrompt !== undefined && prompt !== agentPrompt
            ? <DirectionRevertButton onRevert={() => setPrompt(agentPrompt)} />
            : null}
          <CharacterCount count={prompt.length} limit={SEED_AUDIO_PROMPT_CHARACTER_LIMIT} />
        </>}
      />
      <div className='flex flex-wrap items-center gap-[22px]'>
        <CodexPanelGenerateButton generating={interaction.actionActive} disabled={generateDisabled} onGenerate={generate} />
      </div>
      <DirectionGenerateDisclosure>{`Generate uploads the chosen voice samples and this performance prompt to ${provider} and runs one paid Seed Audio 1.0 generation with your saved ${provider} key.`}</DirectionGenerateDisclosure>
      <DialogueTakeList
        takes={session.takes}
        selection={selection}
        action={session.action}
        media={media}
        autoPlayTakeId={interaction.autoPlayTakeId}
        disabled={!interaction.connected || interaction.busy}
        onSelect={(takeId, selected) => { void interaction.selectTake(takeId, selected); }}
        onDiscard={(takeId) => { void interaction.discardTake(takeId); }}
      />
    </DirectionPanelFrame>
  );
}
