import { readStudioApiError } from './studio-api-errors';

export async function uploadFileBatch<T>(url: string, files: File[]): Promise<T | null> {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) throw new Error('Studio API token is not available.');
  let result: T | null = null;
  for (const file of files) {
    const response = await fetch(`${url}?fileName=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Renku-Studio-Token': token },
      body: await file.arrayBuffer(),
    });
    if (!response.ok) {
      const error = await readStudioApiError(response);
      error.message = `${file.name}: ${error.message}`;
      throw error;
    }
    result = await response.json() as T;
  }
  return result;
}
