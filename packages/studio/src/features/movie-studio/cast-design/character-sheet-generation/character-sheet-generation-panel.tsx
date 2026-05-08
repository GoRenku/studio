import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/ui/button';
import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs, TabsContent } from '@/ui/tabs';
import {
  characterSheetCostPerTake,
  characterSheetProviderModels,
  characterSheetStyleOptions,
  referenceImageMockContent,
} from '../mock/cast-design-mock-content';
import type {
  CharacterSheetGenerationOptions,
  CharacterSheetModelId,
  CharacterSheetOutputFormat,
  CharacterSheetProviderId,
  CharacterSheetQuality,
  CharacterSheetSize,
  CharacterSheetStyleId,
  CharacterSheetThinkingLevel,
} from '../cast-design-types';
import { CharacterSheetAdvancedForm } from './character-sheet-advanced-form';
import { CharacterSheetDesignForm } from './character-sheet-design-form';
import { CharacterSheetGenerationCommandBar } from './character-sheet-generation-command-bar';

type CharacterSheetGenerationTabId = 'design' | 'advanced';

const initialGenerationOptions: CharacterSheetGenerationOptions = {
  provider: 'fal-ai',
  model: 'nano-banana-2',
  sheetStyle: 'all-in-one',
  size: '1K',
  outputFormat: 'PNG',
  quality: 'Medium',
  seed: '128934',
  safetyTolerance: 3,
  webSearchEnabled: false,
  thinkingLevel: 'minimal',
  takeCount: 5,
  characterDescription: '',
};

interface CharacterSheetGenerationPanelProps {
  onClose: () => void;
}

export function CharacterSheetGenerationPanel({
  onClose,
}: CharacterSheetGenerationPanelProps) {
  const [activeTab, setActiveTab] =
    useState<CharacterSheetGenerationTabId>('design');
  const [options, setOptions] = useState<CharacterSheetGenerationOptions>(
    initialGenerationOptions
  );

  const availableModels = useMemo(
    () => characterSheetProviderModels[options.provider],
    [options.provider]
  );
  const estimatedCost =
    characterSheetCostPerTake[options.model] * options.takeCount;

  const updateProvider = (provider: CharacterSheetProviderId) => {
    setOptions((currentOptions) => ({
      ...currentOptions,
      provider,
      model: characterSheetProviderModels[provider][0],
    }));
  };

  const updateModel = (model: CharacterSheetModelId) => {
    setOptions((currentOptions) => ({
      ...currentOptions,
      model,
    }));
  };

  const updateCharacterDescription = (characterDescription: string) => {
    setOptions((currentOptions) => ({
      ...currentOptions,
      characterDescription,
    }));
  };

  const updateSheetStyle = (sheetStyle: CharacterSheetStyleId) => {
    setOptions((currentOptions) => ({
      ...currentOptions,
      sheetStyle,
    }));
  };

  const updateSize = (size: CharacterSheetSize) => {
    setOptions((currentOptions) => ({ ...currentOptions, size }));
  };

  const updateOutputFormat = (outputFormat: CharacterSheetOutputFormat) => {
    setOptions((currentOptions) => ({ ...currentOptions, outputFormat }));
  };

  const updateQuality = (quality: CharacterSheetQuality) => {
    setOptions((currentOptions) => ({ ...currentOptions, quality }));
  };

  const updateSeed = (seed: string) => {
    setOptions((currentOptions) => ({ ...currentOptions, seed }));
  };

  const randomizeSeed = () => {
    setOptions((currentOptions) => ({
      ...currentOptions,
      seed: String(Math.floor(Math.random() * 1_000_000_000)),
    }));
  };

  const updateSafetyTolerance = (safetyTolerance: number) => {
    setOptions((currentOptions) => ({
      ...currentOptions,
      safetyTolerance,
    }));
  };

  const updateWebSearch = (webSearchEnabled: boolean) => {
    setOptions((currentOptions) => ({
      ...currentOptions,
      webSearchEnabled,
    }));
  };

  const updateThinkingLevel = (
    thinkingLevel: CharacterSheetThinkingLevel
  ) => {
    setOptions((currentOptions) => ({
      ...currentOptions,
      thinkingLevel,
    }));
  };

  const updateTakeCount = (takeCount: number) => {
    setOptions((currentOptions) => ({
      ...currentOptions,
      takeCount,
    }));
  };

  return (
    <aside className='fixed inset-0 z-50 flex min-h-0 w-full flex-col border-l border-border/40 bg-sidebar-bg shadow-2xl lg:static lg:z-auto lg:w-[50vw] lg:shrink-0'>
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as CharacterSheetGenerationTabId)
        }
        className='flex min-h-0 flex-1 flex-col gap-0'
      >
        <div className='relative shrink-0'>
          <LineTabBar
            items={[
              { value: 'design', label: 'Character Sheet' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2'
            onClick={onClose}
            aria-label='Close character sheet generation panel'
          >
            <X className='h-4 w-4' />
          </Button>
        </div>

        <TabsContent value='design' className='min-h-0 overflow-y-auto p-4'>
          <CharacterSheetDesignForm
            options={options}
            referenceImages={referenceImageMockContent}
            sheetStyles={characterSheetStyleOptions}
            onCharacterDescriptionChange={updateCharacterDescription}
            onSheetStyleChange={updateSheetStyle}
          />
        </TabsContent>

        <TabsContent value='advanced' className='min-h-0 overflow-y-auto p-5'>
          <CharacterSheetAdvancedForm
            options={options}
            availableModels={availableModels}
            onProviderChange={updateProvider}
            onModelChange={updateModel}
            onSizeChange={updateSize}
            onOutputFormatChange={updateOutputFormat}
            onQualityChange={updateQuality}
            onSeedChange={updateSeed}
            onRandomizeSeed={randomizeSeed}
            onSafetyToleranceChange={updateSafetyTolerance}
            onWebSearchChange={updateWebSearch}
            onThinkingLevelChange={updateThinkingLevel}
          />
        </TabsContent>
      </Tabs>

      <CharacterSheetGenerationCommandBar
        model={options.model}
        modelOptions={availableModels}
        takeCount={options.takeCount}
        estimatedCost={estimatedCost}
        onModelChange={updateModel}
        onTakeCountChange={updateTakeCount}
      />
    </aside>
  );
}
