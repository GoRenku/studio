import { useState } from 'react';
import type { CastMember } from '@gorenku/studio-core';
import {
  castCharacterSheetMockContent,
  castDescriptionMockContent,
  castVoiceDesignMockContent,
} from './mock/cast-design-mock-content';
import { CastCharacterSheetTab } from './tabs/cast-character-sheet-tab';
import { CastDescriptionTab } from './tabs/cast-description-tab';
import { CastDesignTabBar } from './tabs/cast-design-tab-bar';
import type { CastDesignAsset, CastDesignTabId } from './cast-design-types';
import { CastVoiceDesignTab } from './tabs/cast-voice-design-tab';
import { CharacterSheetGenerationPanel } from './character-sheet-generation/character-sheet-generation-panel';

interface CastDesignPanelProps {
  castEntry: CastMember;
}

export function CastDesignPanel({ castEntry }: CastDesignPanelProps) {
  const [activeTab, setActiveTab] = useState<CastDesignTabId>('description');
  const [characterSheetGenerationOpen, setCharacterSheetGenerationOpen] =
    useState(false);

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
          {activeTab === 'description' ? (
            <CastDescriptionTab
              content={castDescriptionMockContent}
              onOpenDetails={() => undefined}
            />
          ) : null}
          {activeTab === 'character-sheet' ? (
            <CastCharacterSheetTab
              content={castCharacterSheetMockContent}
              onNewTake={openCharacterSheetGeneration}
              onOpenDetails={openAssetDetails}
            />
          ) : null}
          {activeTab === 'voice-design' ? (
            <CastVoiceDesignTab
              content={castVoiceDesignMockContent}
              onOpenDetails={() => undefined}
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
