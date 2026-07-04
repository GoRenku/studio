import { ProjectDataError } from '../../project-data-error.js';
import {
  ProjectStoreSchemaGenerationResolutionError,
  resolveCurrentProjectStoreSchemaGeneration,
} from './project-store-schema-generation-reader.js';

export function currentProjectStoreSchemaGeneration(): number {
  try {
    return resolveCurrentProjectStoreSchemaGeneration();
  } catch (error) {
    if (error instanceof ProjectStoreSchemaGenerationResolutionError) {
      throw new ProjectDataError(error.code, error.message);
    }
    throw error;
  }
}
