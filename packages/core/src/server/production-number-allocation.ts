import {
  allocateOrderedProductionNumber,
  ProductionNumberAllocationError,
  type OrderedProductionNumberAllocationInput,
} from '../client/production-numbers.js';
import { ProjectDataError } from './project-data-error.js';

export function allocateProductionNumberOrThrow(
  input: OrderedProductionNumberAllocationInput
): string {
  try {
    return allocateOrderedProductionNumber(input);
  } catch (error) {
    if (!(error instanceof ProductionNumberAllocationError)) {
      throw error;
    }
    throw new ProjectDataError(
      'PRODUCTION_NUMBER_ALLOCATION_EXHAUSTED',
      'A short stable production number could not be allocated.',
      {
        suggestion: 'Inspect the owning number reservations before retrying the write.',
      }
    );
  }
}
