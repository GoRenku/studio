import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  GenerationPreviewConfigurationValue,
  GenerationPreviewRequest,
} from './generation-preview.js';
import type {
  MediaGenerationRun,
  MediaGenerationSpecRecord,
} from './media-generation-lifecycle.js';

export type ImageRevisionTarget =
  | {
      kind: 'castCharacterSheet';
      castMemberId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'locationEnvironmentSheet';
      locationId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'lookbookImage';
      lookbookId: string;
      imageId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'lookbookSheet';
      lookbookId: string;
      sheetId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'shotVideoTakeInput';
      sceneId: string;
      takeId: string;
      inputId: string;
      assetId: string;
      assetFileId: string;
    };

export type ImageRevisionMode = 'regenerate' | 'edit';

export type GenerationEditorControl =
  | {
      controlId: string;
      kind: 'readonly';
      label: string;
      value: GenerationPreviewConfigurationValue;
    }
  | {
      controlId: string;
      kind: 'select';
      label: string;
      value: GenerationPreviewConfigurationValue;
      required: boolean;
      options: Array<{
        label: string;
        value: GenerationPreviewConfigurationValue;
      }>;
    }
  | {
      controlId: string;
      kind: 'number';
      label: string;
      value: number;
      required: boolean;
      min?: number;
      max?: number;
      step?: number;
    };

export interface ImageRevisionDraft {
  mode: ImageRevisionMode;
  authoredText: string;
  negativeText?: string;
  referenceSelections: Array<{
    dependencyId: string;
    selected: boolean;
  }>;
  generationControls: Array<{
    controlId: string;
    value: GenerationPreviewConfigurationValue;
  }>;
}

export type ImageRevisionModeContext =
  | {
      state: 'available';
      mode: ImageRevisionMode;
      draft: ImageRevisionDraft;
      preview: GenerationPreviewRequest | null;
      controls: GenerationEditorControl[];
      diagnostics: DiagnosticIssue[];
    }
  | {
      state: 'unavailable';
      mode: ImageRevisionMode;
      diagnostics: DiagnosticIssue[];
    };

export interface ImageRevisionEditorContext {
  target: ImageRevisionTarget;
  source: {
    title: string;
    assetId: string;
    assetFileId: string;
  };
  regenerate: ImageRevisionModeContext;
  edit: ImageRevisionModeContext;
}

export interface ImageRevisionEstimateReport {
  preview: GenerationPreviewRequest;
  estimatedUsd: number | null;
  diagnostics: DiagnosticIssue[];
}

export interface ImageRevisionRunReport {
  spec: MediaGenerationSpecRecord;
  run: MediaGenerationRun;
  imported: {
    assetId: string;
    assetFileId: string;
  };
  resourceKeys: string[];
}
