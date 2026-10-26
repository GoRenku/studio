import { useState } from 'react';
import type { CastingBoardActAction, CastingSheetBoard } from '@gorenku/studio-codex/casting-board';
import { CastingSubjectChoice } from '@/features/casting-views/casting-subject-choice';
import { castingSceneLabels, shortSceneLabel } from '@/features/casting-views/scene-labels';
import { usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { actOnCastingBoard, requestFromCastingBoard } from '@/services/codex-casting-board';
import { Tabs, TabsList } from '@/ui/tabs';
import { boardCandidates, type BoardCandidate } from './board-summaries';
import type { CastingBoardInteraction } from './casting-board-interaction';
import { CastingRoundsBoard } from './casting-rounds-board';

type SheetCostume = CastingSheetBoard['costumes'][number];

/** The character sheet rounds of a Look's costumes, one costume at a time: hide, compare and pick sheets. */
export function SheetBoardView(input: CastingBoardInteraction & { board: CastingSheetBoard }) {
  const { board, interaction, media, notice } = input;
  const [costumeId, setCostumeId] = useState(() => openingCostumeId(board));
  const costume = board.costumes.find((entry) => entry.id === costumeId) ?? board.costumes[0];
  const scenes = castingSceneLabels(board.scenes);
  const picked = board.costumes.filter((entry) => entry.pickedAssetFileId).length;
  const disabled = !interaction.connected || interaction.busy;

  const act = (action: CastingBoardActAction) => interaction.run(async (connected, current) => {
    interaction.applySession((await actOnCastingBoard(connected, { sessionId: current.sessionId, action })).session);
  });
  const requestMore = (notes: string, forCostume: string) => interaction.generate((connected, current) => requestFromCastingBoard(connected, { sessionId: current.sessionId, request: { kind: 'moreLikeKept', notes, costumeId: forCostume } }));
  const toggleHidden = (candidate: BoardCandidate) => {
    void act({ kind: candidate.status === 'hidden' ? 'restore' : 'hide', assetFileId: candidate.assetFileId });
  };

  const header = (comparing: boolean) => (
    <>
      <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
        <h1 className='m-0 text-sm font-semibold'>{comparing ? 'Compare' : 'Character sheets'}</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{board.castMember.name} · {comparing && costume ? costume.name : board.look.name}</span>
        {comparing ? null : <span className='ml-auto text-xs text-[var(--dd-muted-fg)]'>{picked} of {board.costumes.length} picked</span>}
      </header>
      {notice}
    </>
  );

  if (!costume) {
    return (
      <section aria-label='Character sheets' className='image-edit flex h-screen min-h-0 flex-col overflow-hidden'>
        {header(false)}
        <p className='m-0 px-[18px] py-2 text-[12.5px] text-[var(--dd-muted-fg)]'>No costumes for this Look yet.</p>
      </section>
    );
  }
  return (
    <section aria-label='Character sheets' className='image-edit flex h-screen min-h-0 flex-col overflow-hidden'>
      <CastingRoundsBoard
        key={costume.id}
        kind='characterSheets'
        rounds={costume.rounds}
        chosenAssetFileId={costume.pickedAssetFileId}
        media={media}
        disabled={disabled}
        chooseDisabled={interaction.actionActive}
        emptyMessage={`No character sheet rounds for ${costume.name} yet.`}
        header={header}
        above={(
          <Tabs value={costume.id} onValueChange={setCostumeId} className='px-[18px] pb-2'>
            <TabsList variant='line' aria-label='Costumes' className='flex h-auto w-full justify-start gap-2.5 overflow-x-auto p-0 group-data-[orientation=horizontal]/tabs:h-auto'>
              {board.costumes.map((entry) => <CostumeChoice key={entry.id} costume={entry} sceneLabel={shortSceneLabel(entry.sceneIds, scenes)} media={media} />)}
            </TabsList>
          </Tabs>
        )}
        onToggleHidden={toggleHidden}
        onChoose={(assetFileId) => { void act({ kind: 'pickSheet', costumeId: costume.id, assetFileId }); }}
        onMoreLikeKept={(notes) => { void requestMore(notes, costume.id); }}
      />
    </section>
  );
}

/** The costume the agent named, else the first one still without a picked sheet, else the first. */
function openingCostumeId(board: CastingSheetBoard): string | undefined {
  return board.costumes.find((costume) => costume.id === board.focusCostumeId)?.id
    ?? board.costumes.find((costume) => !costume.pickedAssetFileId)?.id
    ?? board.costumes[0]?.id;
}

function CostumeChoice(input: { costume: SheetCostume; sceneLabel: string; media: PanelMediaLibrary }) {
  const { costume } = input;
  const sheets = boardCandidates(costume.rounds);
  const pickedSheet = sheets.find((sheet) => sheet.assetFileId === costume.pickedAssetFileId);
  const { url } = usePanelMediaUrl(input.media, pickedSheet?.imageUri ?? null);
  return (
    <CastingSubjectChoice
      value={costume.id}
      name={costume.name}
      imageUrl={url ?? null}
      emptyLabel={sheets.length > 0 ? 'Not picked yet' : 'No sheets yet'}
      details={[input.sceneLabel, ...(sheets.length > 0 ? [`${sheets.length} ${sheets.length === 1 ? 'sheet' : 'sheets'}`] : [])]}
      doneLabel={pickedSheet ? 'Picked' : null}
    />
  );
}
