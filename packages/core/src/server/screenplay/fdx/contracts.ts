import type {
  DialogueTurnId,
  SceneId,
  ScreenplayReferenceTarget,
} from '../../../client/screenplay/index.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';

export const FDX_IMPORTER_VERSION = 1;

export type ScreenplayImportId = string;

export type ScreenplayImportLogEntry =
  | {
      type: 'paragraphNormalization';
      sourceParagraphIndex: number;
      sourceParagraphType: 'General';
      targetBlockType: 'action' | 'transition';
    }
  | {
      type: 'orphanDialogueNormalization';
      sourceParagraphIndex: number;
      sourceParagraphType: 'Dialogue';
      targetBlockType: 'action';
    };

export interface ScreenplayImport {
  id: ScreenplayImportId;
  sourceAssetId: string;
  sourceAssetFileId: string;
  importerVersion: typeof FDX_IMPORTER_VERSION;
  importedAt: string;
  technicalLog: ScreenplayImportLogEntry[];
}

export interface ScreenplayImportCandidates {
  characterCues: Array<{
    characterName: string;
    turnIds: DialogueTurnId[];
  }>;
  sceneHeadings: Array<{
    sceneId: SceneId;
    heading: string;
  }>;
  taggedSubjects: Array<{
    label: string;
    category: string;
    target: ScreenplayReferenceTarget;
  }>;
}

export interface ImportFdxScreenplayInput extends RenkuConfigPathOptions {
  projectName: string;
  sourcePath: string;
}

export interface ImportFdxScreenplayReport {
  valid: true;
  warnings: [];
  status: 'imported' | 'refreshed' | 'unchanged';
  project: { id: string; projectName: string };
  screenplayImport: {
    id: ScreenplayImportId;
    sourceAssetId: string;
    sourceAssetFileId: string;
    importerVersion: typeof FDX_IMPORTER_VERSION;
    importedAt: string;
    sourceFilename: string;
    sha256: string;
  };
  counts: {
    scenes: number;
    blocks: number;
    dialogueTurns: number;
    productionSceneNumbers: number;
  };
  candidates: ScreenplayImportCandidates;
  resourceKeys: string[];
}
