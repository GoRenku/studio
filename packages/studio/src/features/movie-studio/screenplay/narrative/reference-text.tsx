import type { ReactNode } from 'react';
import type {
  ScreenplayReference,
  StudioSelection,
} from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import {
  isSceneDialogueAudioTag,
  SCENE_DIALOGUE_AUDIO_TAG_CLASS_NAME,
} from '../../scenes/scene-dialogue-audio-tags';
import { SubjectPreview } from './subject-preview';

export function ReferenceText({
  projectName,
  text,
  references,
  onSelect,
  interactive = true,
}: {
  projectName: string;
  text: string;
  references: ScreenplayReference[];
  onSelect: (selection: StudioSelection) => void;
  interactive?: boolean;
}) {
  const exactReferences = references
    .filter((reference) => reference.range)
    .sort((left, right) => left.range!.start - right.range!.start);
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const reference of exactReferences) {
    const range = reference.range!;
    if (range.start < cursor || range.start > text.length) continue;
    if (range.start > cursor) {
      nodes.push(
        <span key={`text-${cursor}`}>
          {renderAudioTags(text.slice(cursor, range.start))}
        </span>
      );
    }
    const end = Math.min(text.length, range.start + range.length);
    const label = text.slice(range.start, end);
    const selection = subjectSelection(reference);
    const trigger = interactive ? (
      <Button
        key={reference.id}
        type='button'
        variant='link'
        onClick={() => onSelect(selection)}
        className='h-auto p-0 align-baseline font-[inherit] text-[inherit] font-semibold leading-[inherit] text-primary underline decoration-primary/40 decoration-1 underline-offset-[3px] hover:decoration-primary'
      >
        {label}
      </Button>
    ) : (
      <span
        key={reference.id}
        className='font-semibold text-primary underline decoration-primary/40 decoration-1 underline-offset-[3px]'
      >
        {label}
      </span>
    );
    nodes.push(
      interactive ? (
        <SubjectPreview
          key={`preview-${reference.id}`}
          projectName={projectName}
          subject={reference.subject}
          trigger={trigger}
        />
      ) : (
        trigger
      )
    );
    cursor = end;
  }
  if (cursor < text.length) {
    nodes.push(
      <span key={`text-${cursor}`}>{renderAudioTags(text.slice(cursor))}</span>
    );
  }
  return <>{nodes}</>;
}

function subjectSelection(reference: ScreenplayReference): StudioSelection {
  if (reference.subject.type === 'castMember') {
    return { type: 'castMember', id: reference.subject.id };
  }
  if (reference.subject.type === 'location') {
    return { type: 'location', id: reference.subject.id };
  }
  return { type: 'prop', id: reference.subject.id };
}

function renderAudioTags(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const tagPattern = /\[[^\]\n]{1,48}\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    nodes.push(
      isSceneDialogueAudioTag(match[0]) ? (
        <span key={`${match.index}-${match[0]}`} className={SCENE_DIALOGUE_AUDIO_TAG_CLASS_NAME}>
          {match[0]}
        </span>
      ) : (
        match[0]
      )
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
