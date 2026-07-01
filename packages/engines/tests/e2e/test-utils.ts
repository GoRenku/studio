import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Note: provider environment variables are loaded by vitest.e2e.config.ts.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Conditionally save test artifacts to disk based on SAVE_TEST_ARTIFACTS environment variable.
 * When enabled, files are saved to packages/engines/tmp/ directory (which is git-ignored).
 *
 * @param filename - Name of the file to save (e.g., 'test-video.mp4')
 * @param data - File data as Uint8Array or string
 */
export function saveTestArtifact(filename: string, data: Uint8Array | string): void {
  if (process.env.SAVE_TEST_ARTIFACTS === '1') {
    // Save to engines/tmp instead of directly in tests/e2e.
    const tmpDir = join(__dirname, '..', '..', 'tmp');
    const outputPath = join(tmpDir, filename);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(outputPath, data);
    console.log(`Test artifact saved to: ${outputPath}`);
  }
}
