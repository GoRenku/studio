export {
  RENKU_CONFIG_VERSION,
  initRenkuConfig,
  readRenkuConfig,
  resolveRenkuStorageRoot,
  type InitRenkuConfigOptions,
  type InitRenkuConfigResult,
  type ReadRenkuConfigOptions,
  type RenkuConfig,
} from './document.js';
export { RenkuConfigError } from './errors.js';
export {
  RENKU_CONFIG_DIR_NAME,
  RENKU_CONFIG_FILE_NAME,
  resolveRecommendedRenkuStorageRoot,
  resolveRenkuConfigDir,
  resolveRenkuConfigPath,
  type RenkuConfigPathOptions,
} from './paths.js';
export {
  initializeRenkuSetup,
  readRenkuSetup,
} from './setup.js';
