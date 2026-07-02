import fs from 'node:fs/promises';
import type { AssetFile, AssetTarget } from '@gorenku/studio-core/server';
import type { ProjectsRouteProjectData } from '../routes/projects.js';

export async function readAssetFileResponse(
  projectData: ProjectsRouteProjectData,
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    assetFileId: string;
  }
): Promise<Response> {
  const resolved = await projectData.resolveProjectAssetFile(input);
  const bytes = await fs.readFile(resolved.absolutePath);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForAssetFile(resolved.file),
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

export async function readShotVideoTakeInputFileResponse(
  projectData: ProjectsRouteProjectData,
  input: {
    projectName: string;
    sceneId: string;
    takeId: string;
    inputId: string;
    assetFileId: string;
  }
): Promise<Response> {
  const resolved = await projectData.resolveShotVideoTakeInputFile(input);
  const bytes = await fs.readFile(resolved.absolutePath);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForAssetFile(resolved.file),
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

export async function readShotVideoTakeVideoFileResponse(
  projectData: ProjectsRouteProjectData,
  input: {
    projectName: string;
    sceneId: string;
    takeId: string;
    assetFileId: string;
  }
): Promise<Response> {
  const resolved = await projectData.resolveShotVideoTakeVideoFile(input);
  const bytes = await fs.readFile(resolved.absolutePath);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForAssetFile(resolved.file),
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

function contentTypeForAssetFile(file: AssetFile): string {
  if (file.mimeType) {
    return file.mimeType;
  }
  if (file.mediaKind === 'image') {
    const path = file.projectRelativePath.toLowerCase();
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (path.endsWith('.webp')) {
      return 'image/webp';
    }
    if (path.endsWith('.gif')) {
      return 'image/gif';
    }
    return 'image/png';
  }
  if (file.mediaKind === 'audio') {
    return 'audio/mpeg';
  }
  if (file.mediaKind === 'video') {
    return 'video/mp4';
  }
  if (file.mediaKind === 'text') {
    return 'text/plain; charset=utf-8';
  }
  if (file.mediaKind === 'json') {
    return 'application/json';
  }
  return 'application/octet-stream';
}
