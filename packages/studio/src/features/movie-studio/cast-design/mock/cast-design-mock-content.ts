import allInOneSheetDarkUrl from '@/assets/sheet-styles/all-in-one-dark.png';
import allInOneSheetLightUrl from '@/assets/sheet-styles/all-in-one-light.png';
import costumeOutfitSheetDarkUrl from '@/assets/sheet-styles/costume-outfit-sheet-dark.png';
import costumeOutfitSheetLightUrl from '@/assets/sheet-styles/costume-outfit-sheet-light.png';
import expressionSheetDarkUrl from '@/assets/sheet-styles/expression-sheet-dark.png';
import expressionSheetLightUrl from '@/assets/sheet-styles/expression-sheet-light.png';
import poseGestureSheetDarkUrl from '@/assets/sheet-styles/pose-gesture-sheet-dark.png';
import poseGestureSheetLightUrl from '@/assets/sheet-styles/pose-gesture-sheet-light.png';
import turnaroundModelSheetDarkUrl from '@/assets/sheet-styles/turnaround-model-sheet-dark.png';
import turnaroundModelSheetLightUrl from '@/assets/sheet-styles/turnaround-model-sheet-light.png';
import type {
  CastAssetCollection,
  CastDescriptionContent,
  CastDesignAsset,
  CharacterSheetModelId,
  CharacterSheetProviderId,
  CharacterSheetStyleOption,
  ReferenceImage,
} from '../cast-design-types';
import baseSheetUrl from '../sample-assets/character-sheet-base.png';
import sheet16x9Url from '../sample-assets/character-sheet-16x9.png';
import campaignSheetUrl from '../sample-assets/character-sheet-campaign.png';
import courtSheetUrl from '../sample-assets/character-sheet-court.png';
import costume4x3Url from '../sample-assets/costume-reference-4x3.png';
import fullBody9x16Url from '../sample-assets/full-body-9x16.png';
import portrait1x1Url from '../sample-assets/portrait-reference-1x1.png';

export const castDescriptionMockContent: CastDescriptionContent = {
  descriptionText: `Young Ottoman ruler, controlled and austere, with a court presence that should feel intelligent rather than theatrical.

- Carries authority through stillness rather than performance.
- Costume language should be royal, severe, and practical.
- Face references should stay young without becoming soft.`,
  descriptionImages: [
    {
      id: 'description-face',
      title: 'Face reference',
      model: 'gpt-image-2',
      kind: 'image',
      imageUrl: portrait1x1Url,
      aspect: 'square',
      selected: true,
    },
    {
      id: 'description-costume',
      title: 'Costume reference',
      model: 'gpt-image-2',
      kind: 'image',
      imageUrl: costume4x3Url,
      aspect: 'ratio-4-3',
      selected: true,
    },
  ],
};

const sheetTakes: Array<Omit<CastDesignAsset, 'id' | 'kind' | 'model'>> = [
  {
    title: '16:9 sheet',
    imageUrl: sheet16x9Url,
    aspect: 'sheet',
  },
  {
    title: '4:3 costume',
    imageUrl: costume4x3Url,
    aspect: 'ratio-4-3',
  },
  {
    title: '1:1 portrait',
    imageUrl: portrait1x1Url,
    aspect: 'square',
  },
  {
    title: '9:16 full body',
    imageUrl: fullBody9x16Url,
    aspect: 'ratio-9-16',
  },
  {
    title: 'Wide sheet',
    imageUrl: baseSheetUrl,
    aspect: 'wide',
  },
  {
    title: 'Court sheet',
    imageUrl: courtSheetUrl,
    aspect: 'sheet',
  },
  {
    title: 'Campaign sheet',
    imageUrl: campaignSheetUrl,
    aspect: 'sheet',
  },
];

export const castCharacterSheetMockContent: CastAssetCollection = {
  emptySelected: 'No character sheets selected.',
  emptyTakes: 'Generated character sheet takes will appear here.',
  selectedAssets: [
    {
      id: 'sheet-base',
      title: 'Base sheet',
      model: 'gpt-image-2',
      kind: 'sheet',
      imageUrl: sheet16x9Url,
      aspect: 'sheet',
      selected: true,
    },
    {
      id: 'sheet-alternate',
      title: 'Alternate costume',
      model: 'nano-banana-2',
      kind: 'sheet',
      imageUrl: fullBody9x16Url,
      aspect: 'ratio-9-16',
      selected: true,
    },
  ],
  takes: Array.from({ length: 12 }, (_, index) => {
    const take = sheetTakes[index % sheetTakes.length];
    return {
      ...take,
      id: `sheet-take-${index + 1}`,
      model: ['gpt-image-2', 'nano-banana-2', 'grok-imagine-image'][
        index % 3
      ],
      kind: 'sheet',
    };
  }),
};

export const castVoiceDesignMockContent: CastAssetCollection = {
  emptySelected:
    'No voice selected. Add this only if the character speaks or needs narration continuity.',
  emptyTakes: 'Generated voice takes will appear here.',
  selectedAssets: [
    {
      id: 'voice-selected',
      title: 'Voice take',
      model: 'ElevenLabs',
      kind: 'voice',
      aspect: 'voice',
      selected: true,
    },
  ],
  takes: [
    {
      id: 'voice-take-01',
      title: 'Take 01',
      model: 'ElevenLabs',
      kind: 'voice',
      aspect: 'voice',
    },
    {
      id: 'voice-take-02',
      title: 'Take 02',
      model: 'ElevenLabs',
      kind: 'voice',
      aspect: 'voice',
    },
  ],
};

export const referenceImageMockContent: ReferenceImage[] = [
  {
    id: 'reference-portrait',
    imageUrl: portrait1x1Url,
    label: 'Portrait reference',
    localObjectUrl: false,
  },
  {
    id: 'reference-costume',
    imageUrl: costume4x3Url,
    label: 'Costume reference',
    localObjectUrl: false,
  },
];

export const characterSheetStyleOptions: CharacterSheetStyleOption[] = [
  {
    id: 'all-in-one',
    label: 'All in One',
    lightImageUrl: allInOneSheetLightUrl,
    darkImageUrl: allInOneSheetDarkUrl,
  },
  {
    id: 'turnaround-model',
    label: 'Turnaround',
    lightImageUrl: turnaroundModelSheetLightUrl,
    darkImageUrl: turnaroundModelSheetDarkUrl,
  },
  {
    id: 'expression',
    label: 'Expression',
    lightImageUrl: expressionSheetLightUrl,
    darkImageUrl: expressionSheetDarkUrl,
  },
  {
    id: 'pose-gesture',
    label: 'Pose Gesture',
    lightImageUrl: poseGestureSheetLightUrl,
    darkImageUrl: poseGestureSheetDarkUrl,
  },
  {
    id: 'costume-outfit',
    label: 'Costume Outfit',
    lightImageUrl: costumeOutfitSheetLightUrl,
    darkImageUrl: costumeOutfitSheetDarkUrl,
  },
];

export const characterSheetProviderModels: Record<
  CharacterSheetProviderId,
  CharacterSheetModelId[]
> = {
  'fal-ai': [
    'nano-banana-2',
    'nano-banana-pro',
    'gpt-image-2',
    'grok-imagine-image',
  ],
  replicate: ['gpt-image-2', 'grok-imagine-image'],
};

export const characterSheetCostPerTake: Record<CharacterSheetModelId, number> =
  {
    'nano-banana-2': 0.04,
    'nano-banana-pro': 0.055,
    'gpt-image-2': 0.048,
    'grok-imagine-image': 0.043,
  };
