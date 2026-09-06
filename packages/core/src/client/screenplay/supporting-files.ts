import type { Asset } from '../assets.js';

export interface ProjectSupportingFile {
  asset: Asset;
  sourceAssetFileId: string;
  deleteBlock: { code: string; message: string } | null;
}

export interface ProjectSupportingFilePage {
  items: ProjectSupportingFile[];
  nextCursor: string | null;
}

export interface ProjectSupportingFileInformation {
  supportingFile: ProjectSupportingFile;
  absolutePath: string;
}
