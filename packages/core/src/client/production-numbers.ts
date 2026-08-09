export const PRODUCTION_NUMBER_PATTERN = /^[1-9][0-9]*[A-Za-z]*$/u;

export interface OrderedProductionNumberAllocationInput {
  orderedNumbers: string[];
  reservedNumbers: string[];
  occupiedNumbers?: string[];
  placement:
    | { position: 'end' }
    | { position: 'insert'; index: number };
  maxSuffixLength?: number;
}

export class ProductionNumberAllocationError extends Error {
  constructor(
    readonly code:
      | 'INVALID_INSERTION_INDEX'
      | 'INVALID_PRODUCTION_NUMBER'
      | 'INVALID_SUFFIX_INDEX'
      | 'INVALID_SUFFIX_LENGTH'
      | 'SUFFIX_EXHAUSTED',
    message: string
  ) {
    super(message);
    this.name = 'ProductionNumberAllocationError';
  }
}

export function isProductionNumber(value: string): boolean {
  return PRODUCTION_NUMBER_PATTERN.test(value);
}

export function productionNumberKey(value: string): string {
  return value.toLowerCase();
}

export function formatProductionNumberForDisplay(value: string): string {
  return value.replace(/^([1-9])(?=[A-Za-z]*$)/u, '0$1');
}

export function allocateInitialProductionNumbers(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

export function allocateOrderedProductionNumber(
  input: OrderedProductionNumberAllocationInput
): string {
  const reserved = new Set(input.reservedNumbers.map(productionNumberKey));
  const occupied = new Set(input.occupiedNumbers ?? []);
  if (input.placement.position === 'end') {
    const highestWholeNumber = input.reservedNumbers.reduce(
      (highest, number) => Math.max(highest, leadingInteger(number)),
      0
    );
    let candidate = highestWholeNumber + 1;
    while (occupied.has(String(candidate))) {
      candidate += 1;
    }
    return String(candidate);
  }

  const index = input.placement.index;
  if (!Number.isInteger(index) || index < 0 || index >= input.orderedNumbers.length) {
    throw new ProductionNumberAllocationError(
      'INVALID_INSERTION_INDEX',
      'Production-number insertion index is outside the ordered collection.'
    );
  }
  const family = leadingInteger(
    input.orderedNumbers[index - 1] ?? input.orderedNumbers[index]
  );
  const maxSuffixLength = input.maxSuffixLength ?? 4;
  for (let suffixIndex = 1; suffixIndex <= suffixCapacity(maxSuffixLength); suffixIndex += 1) {
    const candidate = `${family}${alphabeticSuffix(suffixIndex)}`;
    if (!reserved.has(productionNumberKey(candidate)) && !occupied.has(candidate)) {
      return candidate;
    }
  }
  throw new ProductionNumberAllocationError(
    'SUFFIX_EXHAUSTED',
    'Production-number suffix allocation is exhausted.'
  );
}

export function alphabeticSuffix(index: number): string {
  if (!Number.isInteger(index) || index < 1) {
    throw new ProductionNumberAllocationError(
      'INVALID_SUFFIX_INDEX',
      'Alphabetic suffix index must be a positive integer.'
    );
  }
  let remaining = index;
  let suffix = '';
  while (remaining > 0) {
    remaining -= 1;
    suffix = String.fromCharCode(65 + (remaining % 26)) + suffix;
    remaining = Math.floor(remaining / 26);
  }
  return suffix;
}

function leadingInteger(value: string): number {
  const match = /^[1-9][0-9]*/u.exec(value);
  if (!match) {
    throw new ProductionNumberAllocationError(
      'INVALID_PRODUCTION_NUMBER',
      `Invalid production number: ${value}.`
    );
  }
  return Number(match[0]);
}

function suffixCapacity(maxLength: number): number {
  if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 6) {
    throw new ProductionNumberAllocationError(
      'INVALID_SUFFIX_LENGTH',
      'Production-number suffix length must be an integer from 1 through 6.'
    );
  }
  let capacity = 0;
  for (let length = 1; length <= maxLength; length += 1) {
    capacity += 26 ** length;
  }
  return capacity;
}
