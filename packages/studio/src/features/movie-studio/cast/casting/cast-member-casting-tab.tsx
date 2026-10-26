import { useState } from 'react';
import { castingSceneLabels } from '@/features/casting-views/scene-labels';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import { Tabs, TabsContent } from '@/ui/tabs';
import { castLooksRequest } from '../../agent-request-copy';
import { defaultPickedLook } from './casting-summaries';
import { castingSubjects, defaultPickedSubject } from './casting-subjects';
import { LookCasting } from './look-casting';
import { LookPicker } from './look-picker';
import { LookSceneBar } from './look-scene-bar';
import { useCastCasting } from './use-cast-casting';

/** The Casting record of one Cast Member, one Look at a time: its scenes, casting rounds and costumes. */
export function CastMemberCastingTab({
  projectName,
  castMemberId,
}: {
  projectName: string;
  castMemberId: string;
}) {
  const casting = useCastCasting({ projectName, castMemberId });
  const [pickedLookId, setPickedLookId] = useState<string | null>(null);
  const [pickedSubject, setPickedSubject] = useState<{ lookId: string; key: string } | null>(null);
  const { resource } = casting;

  if (casting.error) {
    return <p className='px-8 pt-7 text-sm text-destructive'>{casting.error}</p>;
  }
  if (!resource) {
    return <p className='px-8 pt-7 text-sm text-muted-foreground'>Loading casting...</p>;
  }
  const picked = resource.looks.find((look) => look.id === pickedLookId) ?? defaultPickedLook(resource.looks);
  if (!picked) {
    return (
      <PanelEmptyState
        title={`${resource.castMember.name} isn't cast yet`}
        description='Casting finds the person for each look of this character, then plans a costume per scene and makes a character sheet for each costume.'
        request={castLooksRequest(resource.castMember.name)}
      />
    );
  }
  const scenes = castingSceneLabels(resource.scenes);
  const costumes = resource.costumes.filter((costume) => costume.lookId === picked.id);
  const subjects = castingSubjects(picked, costumes);
  const subject = (pickedSubject?.lookId === picked.id ? subjects.find((entry) => entry.key === pickedSubject.key) : undefined)
    ?? defaultPickedSubject(picked, subjects);
  if (pickedSubject?.lookId !== picked.id || pickedSubject.key !== subject.key) {
    setPickedSubject({ lookId: picked.id, key: subject.key });
  }
  const pickLook = (lookId: string) => {
    setPickedLookId(lookId);
    setPickedSubject(null);
  };
  return (
    <article className='min-h-full bg-panel-bg px-8 pb-12 pt-7 text-foreground'>
      <Tabs value={picked.id} onValueChange={pickLook} className='gap-5'>
        <LookPicker looks={resource.looks} />
        {scenes.length > 0 ? (
          <LookSceneBar scenes={scenes} looks={resource.looks} pickedLookId={picked.id} highlightSceneIds={subject.costume ? subject.sceneIds : undefined} />
        ) : null}
        <TabsContent value={picked.id}>
          <LookCasting
            castMemberName={resource.castMember.name}
            look={picked}
            costumes={costumes}
            subjects={subjects}
            pickedSubject={subject}
            scenes={scenes}
            pendingAssetFileId={casting.pendingAssetFileId}
            onPickSubject={(key) => setPickedSubject({ lookId: picked.id, key })}
            onStatusChange={(assetFileId, status) => void casting.setCandidateStatus(assetFileId, status)}
            onCast={(lookId, assetFileId) => void casting.castCandidate(lookId, assetFileId)}
            onPickSheet={(costumeId, assetFileId) => void casting.pickCharacterSheet(costumeId, assetFileId)}
          />
        </TabsContent>
      </Tabs>
    </article>
  );
}
