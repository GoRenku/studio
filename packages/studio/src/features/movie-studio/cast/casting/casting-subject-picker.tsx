import { CastingSubjectChoice } from '@/features/casting-views/casting-subject-choice';
import { shortSceneLabel } from '@/features/casting-views/scene-labels';
import type { SceneStripScene } from '@/features/casting-views/scene-strip';
import type { CastCastingLookResponse } from '@/services/studio-project-contracts';
import { TabsList } from '@/ui/tabs';
import { countLabel, hiddenCount, keptCandidates } from './casting-summaries';
import type { CastingSubject } from './casting-subjects';

/**
 * The row under a cast Look: the Casting card with the cast picture, then one card per costume
 * with its picked sheet. The picked card's rounds show in the box below.
 */
export function CastingSubjectPicker({ look, subjects, scenes }: { look: CastCastingLookResponse; subjects: CastingSubject[]; scenes: SceneStripScene[] }) {
  const [casting, ...costumes] = subjects;
  return (
    <TabsList
      variant='line'
      aria-label={`${look.name} casting and costumes`}
      className='flex h-auto w-full justify-start gap-2.5 overflow-x-auto p-0 pb-0.5 group-data-[orientation=horizontal]/tabs:h-auto'
    >
      <CastingSubjectChoice
        value={casting!.key}
        name='Casting'
        imageUrl={look.castCandidate?.url ?? null}
        emptyLabel='Not cast yet'
        details={castingDetails(casting!)}
        doneLabel={look.castCandidateAssetFileId ? 'Cast' : null}
      />
      <span aria-hidden='true' className='mx-1 my-1.5 w-px flex-none bg-border/60' />
      {costumes.map((subject) => (
        <CastingSubjectChoice
          key={subject.key}
          value={subject.key}
          name={subject.name}
          imageUrl={chosenImageUrl(subject)}
          emptyLabel={sheetTotal(subject) > 0 ? 'Not picked yet' : 'No sheets yet'}
          details={[shortSceneLabel(subject.sceneIds, scenes), ...sheetCount(subject)]}
          doneLabel={subject.chosenAssetFileId ? 'Picked' : null}
        />
      ))}
    </TabsList>
  );
}

function castingDetails(subject: CastingSubject): string[] {
  const hidden = hiddenCount(subject.rounds, subject.chosenAssetFileId);
  return [`${keptCandidates(subject.rounds, subject.chosenAssetFileId).length} kept`, ...(hidden > 0 ? [`${hidden} hidden`] : [])];
}

function sheetTotal(subject: CastingSubject): number {
  return subject.rounds.reduce((sum, round) => sum + round.candidates.length, 0);
}

function sheetCount(subject: CastingSubject): string[] {
  const total = sheetTotal(subject);
  return total > 0 ? [countLabel(total, 'sheet')] : [];
}

function chosenImageUrl(subject: CastingSubject): string | null {
  const chosen = subject.rounds.flatMap((round) => round.candidates).find((candidate) => candidate.assetFileId === subject.chosenAssetFileId);
  return chosen?.assetFile.url ?? null;
}
