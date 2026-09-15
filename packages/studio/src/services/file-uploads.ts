import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';
import { readStudioApiError } from './studio-api-errors';

export async function uploadFileBatch<T>(url: string, files: File[]): Promise<T | null> {
  const token = readStudioApiToken();
  let result: T | null = null;
  for (const file of files) {
    const response = await studioApiFetch(`${url}?fileName=${encodeURIComponent(file.name)}`, {
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
