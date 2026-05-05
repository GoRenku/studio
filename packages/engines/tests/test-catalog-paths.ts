/**
 * Test utility for resolving catalog paths.
 * Tests should use this instead of hardcoded paths.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Engines package root directory */
export const PACKAGE_ROOT = resolve(__dirname, '..');

/** Repository root directory */
export const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');

/** Shared test fixtures root used by engines tests */
export const SHARED_TEST_FIXTURES_ROOT = resolve(__dirname, 'fixtures');

/** Shared media fixtures used by engines tests */
export const SHARED_TEST_MEDIA_ROOT = resolve(
  SHARED_TEST_FIXTURES_ROOT,
  'media'
);

/** Shared test catalog used across packages */
export const SHARED_TEST_CATALOG_ROOT = resolve(
  SHARED_TEST_FIXTURES_ROOT,
  'catalog'
);

/** Providers test fixtures directory */
export const TEST_FIXTURES_ROOT = resolve(__dirname, 'fixtures');

/** Engines catalog root consumed by engines tests */
export const CATALOG_ROOT = resolve(PACKAGE_ROOT, 'catalog');

/** Models directory within the catalog */
export const CATALOG_MODELS_ROOT = resolve(CATALOG_ROOT, 'models');
