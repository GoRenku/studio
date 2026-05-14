import crypto from 'node:crypto';
import path from 'node:path';
import type {
  ProductionExportVariant,
  ProjectRelativePath,
} from '../../client/index.js';
import type { DesiredProductionExportFile } from './types.js';

export function buildProductionTreeHash(
  rootProjectRelativePath: ProjectRelativePath,
  variant: ProductionExportVariant,
  files: DesiredProductionExportFile[]
): string {
  const root = createFolderNode(rootProjectRelativePath);
  for (const file of files) {
    addFileNode(root, file);
  }
  const rootHash = hashFolderNode(root);
  return hashJson({
    type: 'variant',
    variant,
    rootProjectRelativePath,
    rootHash,
  });
}

interface FolderNode {
  name: string;
  folders: Map<string, FolderNode>;
  files: Map<string, string>;
}

function createFolderNode(name: string): FolderNode {
  return { name, folders: new Map(), files: new Map() };
}

function addFileNode(root: FolderNode, file: DesiredProductionExportFile): void {
  const relativeTarget = path.posix.relative(
    file.variantRootProjectRelativePath,
    file.targetProjectRelativePath
  );
  const segments = relativeTarget.split('/');
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    const existing = current.folders.get(segment) ?? createFolderNode(segment);
    current.folders.set(segment, existing);
    current = existing;
  }
  current.files.set(
    segments[segments.length - 1] ?? file.targetProjectRelativePath,
    hashJson({
      type: 'file',
      assetId: file.assetId,
      relationshipId: file.relationshipId,
      assetFileId: file.assetFileId,
      role: file.role,
      sourceContentHash: file.sourceContentHash,
      sourceSizeBytes: file.sourceSizeBytes,
      targetProjectRelativePath: file.targetProjectRelativePath,
    })
  );
}

function hashFolderNode(node: FolderNode): string {
  const folders = [...node.folders.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, child]) => [name, hashFolderNode(child)]);
  const files = [...node.files.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return hashJson({
    type: 'folder',
    name: node.name,
    folders,
    files,
  });
}

function hashJson(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
