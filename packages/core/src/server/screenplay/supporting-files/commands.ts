import { discardAsset } from '../../commands/discard-asset.js';
import { readProjectSupportingFileInformation } from './resources.js';

export async function discardProjectSupportingFile(input: {
  projectName: string;
  assetId: string;
  homeDir?: string;
}) {
  const { supportingFile } = await readProjectSupportingFileInformation(input);
  return discardAsset({
    ...input,
    owner: { kind: 'project' },
    expectedType: supportingFile.asset.type,
  });
}
