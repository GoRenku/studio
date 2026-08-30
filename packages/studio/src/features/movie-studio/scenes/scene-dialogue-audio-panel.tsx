import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import type { SceneDialogueAudioWorkspaceWithUrls } from '@/services/screenplay';
import {
  useSceneDialogueAudio,
  type SceneDialogueAudioPlayer,
} from './use-scene-dialogue-audio';
import { SceneDialogueAudioAdvancedTab } from './scene-dialogue-audio-advanced-tab';
import { SceneDialogueAudioDialogTab } from './scene-dialogue-audio-dialog-tab';
import { SceneDialogueAudioTakesTab } from './scene-dialogue-audio-takes-tab';

interface SceneDialogueAudioPanelProps {
  projectName: string;
  sceneId: string;
  turnId: string;
  context: SceneDialogueAudioWorkspaceWithUrls;
  player: SceneDialogueAudioPlayer;
  onClose: () => void;
  onContextChange: (context: SceneDialogueAudioWorkspaceWithUrls) => void;
  onDraftTextPreviewChange?: (text: string | null) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

type DialogueAudioPanelTab = 'dialog' | 'takes' | 'advanced';

export function SceneDialogueAudioPanel({
  projectName,
  sceneId,
  turnId,
  context,
  player,
  onClose,
  onContextChange,
  onDraftTextPreviewChange,
  onSaveNotificationChange,
}: SceneDialogueAudioPanelProps) {
  const [activeTab, setActiveTab] = useState<DialogueAudioPanelTab>('dialog');
  const dialogueAudio = useSceneDialogueAudio({
    projectName,
    sceneId,
    turnId,
    context,
    onDraftTextPreviewChange,
    onContextChange,
  });
  const controlsDisabled = dialogueAudio.actionBusy;
  useEffect(() => {
    onSaveNotificationChange?.(dialogueAudio.autosave);
  }, [dialogueAudio.autosave, onSaveNotificationChange]);

  return (
    <aside className='flex w-[25rem] shrink-0 flex-col border-l border-border/40 bg-panel-bg/80'>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as DialogueAudioPanelTab)}
        className='flex min-h-0 flex-1 flex-col gap-0'
      >
        <div className='flex h-[45px] shrink-0 items-center border-b border-border/40 bg-sidebar-header-bg'>
          <TabsList
            variant='line'
            className='h-full w-auto justify-start gap-0 rounded-none bg-transparent p-0'
          >
            <TabsTrigger
              value='dialog'
              className='h-full flex-none rounded-none border-0 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] data-[state=active]:bg-item-active-bg data-[state=active]:text-foreground data-[state=active]:after:bg-primary'
            >
              Dialog
            </TabsTrigger>
            <TabsTrigger
              value='takes'
              className='h-full flex-none rounded-none border-0 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] data-[state=active]:bg-item-active-bg data-[state=active]:text-foreground data-[state=active]:after:bg-primary'
            >
              Takes
            </TabsTrigger>
            <TabsTrigger
              value='advanced'
              className='h-full flex-none rounded-none border-0 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] data-[state=active]:bg-item-active-bg data-[state=active]:text-foreground data-[state=active]:after:bg-primary'
            >
              Advanced
            </TabsTrigger>
          </TabsList>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={onClose}
            aria-label='Close dialogue audio panel'
            className='ml-auto mr-2'
          >
            <X className='h-4 w-4' aria-hidden />
          </Button>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4'>
          <TabsContent value='dialog' className='m-0'>
            <SceneDialogueAudioDialogTab
              blockedIssue={dialogueAudio.blockedIssue}
              draft={dialogueAudio.draft}
              disabled={controlsDisabled}
              models={context.models}
              nonV3={dialogueAudio.nonV3}
              selectedVoice={dialogueAudio.selectedVoice}
              usableVoices={dialogueAudio.usableVoices}
              onModelChange={dialogueAudio.chooseModel}
              onDraftChange={dialogueAudio.updateDraft}
            />
          </TabsContent>
          <TabsContent value='takes' className='m-0'>
            <SceneDialogueAudioTakesTab
              actionDisabled={dialogueAudio.actionBusy}
              player={player}
              selectedTakeId={dialogueAudio.selectedTakeId}
              takes={dialogueAudio.takes}
              onClearSelection={dialogueAudio.clearTakeSelection}
              onDeleteTake={dialogueAudio.deleteTake}
              onPickTake={dialogueAudio.pickTake}
            />
          </TabsContent>
          <TabsContent value='advanced' className='m-0'>
            <SceneDialogueAudioAdvancedTab
              baseLanguageCode={context.project.baseLanguageCode}
              disabled={controlsDisabled}
              draft={dialogueAudio.draft}
              selectedModel={dialogueAudio.selectedModel}
              onDraftChange={dialogueAudio.updateDraft}
              onReset={dialogueAudio.resetAdvancedValues}
              onVoiceSettingsChange={dialogueAudio.updateVoiceSettings}
            />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}
