import type { AssetFile } from '../asset-files.js';

export interface ProjectSupportingFile {
  assetFile: AssetFile;
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
