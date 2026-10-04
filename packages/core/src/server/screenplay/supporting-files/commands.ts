import { discardAssetFile } from '../../commands/discard-asset-file.js';
import { readProjectSupportingFileInformation } from './resources.js';

export async function discardProjectSupportingFile(input: {
  projectName: string;
  assetFileId: string;
  homeDir?: string;
}) {
  const { supportingFile } = await readProjectSupportingFileInformation(input);
  return discardAssetFile({
    ...input,
    owner: { kind: 'project' },
    expectedType: supportingFile.assetFile.type,
  });
}
