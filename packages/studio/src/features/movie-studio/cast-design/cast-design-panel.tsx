import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CastMember } from '@gorenku/studio-core/client';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { CastCharacterSheetTab } from './tabs/cast-character-sheet-tab';
import { CastDescriptionTab } from './tabs/cast-description-tab';
import { CastDesignTabBar } from './tabs/cast-design-tab-bar';
import type { CastDesignAsset, CastDesignTabId } from './cast-design-types';
import { CastVoiceDesignTab } from './tabs/cast-voice-design-tab';
import { CharacterSheetGenerationPanel } from './character-sheet-generation/character-sheet-generation-panel';
import { useCastDesignAssets } from './use-cast-design-assets';

interface CastDesignPanelProps {
  projectName: string;
  castEntry: CastMember;
}

export function CastDesignPanel({
  projectName,
  castEntry,
}: CastDesignPanelProps) {
  const [activeTab, setActiveTab] = useState<CastDesignTabId>('description');
  const [characterSheetGenerationOpen, setCharacterSheetGenerationOpen] =
    useState(false);
  const castDesignAssets = useCastDesignAssets({
    projectName,
    castEntry,
  });

  const openCharacterSheetGeneration = () => {
    setCharacterSheetGenerationOpen(true);
  };

  const openAssetDetails = (_asset: CastDesignAsset) => {
    setCharacterSheetGenerationOpen(true);
  };

  return (
    <section className='flex h-full min-h-0 flex-col overflow-hidden rounded-(--radius-panel) border border-panel-border bg-panel-bg'>
      <header className='flex h-[45px] shrink-0 items-center justify-between gap-4 border-b border-border/40 bg-panel-header-bg px-4'>
        <div className='min-w-0'>
          <h2 className='truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            {castEntry.name}
          </h2>
        </div>
      </header>

      <CastDesignTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className='flex min-h-0 flex-1'>
        <div className='min-h-0 min-w-0 flex-1'>
          {castDesignAssets.castAssetsError ? (
            <div className='p-5 pb-0'>
              <Alert variant='destructive'>
                <AlertTitle>Cast assets could not load</AlertTitle>
                <AlertDescription>
                  {castDesignAssets.castAssetsError}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
          {castDesignAssets.isLoadingCastAssets ? (
            <div className='flex h-full min-h-0 items-center justify-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Loading cast assets...
            </div>
          ) : null}
          {!castDesignAssets.isLoadingCastAssets && activeTab === 'description' ? (
            <CastDescriptionTab
              content={castDesignAssets.descriptionContent}
              onOpenDetails={() => undefined}
            />
          ) : null}
          {!castDesignAssets.isLoadingCastAssets && activeTab === 'character-sheet' ? (
            <CastCharacterSheetTab
              content={castDesignAssets.characterSheetContent}
              onNewTake={openCharacterSheetGeneration}
              onOpenDetails={openAssetDetails}
              onSelectAsset={(asset) => {
                void castDesignAssets.selectCastDesignAsset(asset);
              }}
              onUnselectAsset={(asset) => {
                void castDesignAssets.unselectCastDesignAsset(asset);
              }}
            />
          ) : null}
          {!castDesignAssets.isLoadingCastAssets && activeTab === 'voice-design' ? (
            <CastVoiceDesignTab
              content={castDesignAssets.voiceDesignContent}
              onOpenDetails={() => undefined}
              onSelectAsset={(asset) => {
                void castDesignAssets.selectCastDesignAsset(asset);
              }}
              onUnselectAsset={(asset) => {
                void castDesignAssets.unselectCastDesignAsset(asset);
              }}
            />
          ) : null}
        </div>

        {characterSheetGenerationOpen ? (
          <CharacterSheetGenerationPanel
            onClose={() => setCharacterSheetGenerationOpen(false)}
          />
        ) : null}
      </div>
    </section>
  );
}
