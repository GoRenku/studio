import crypto from 'node:crypto';

export const GENERATION_FILE_TOKEN_ALPHABET =
  '0123456789abcdefghjkmnpqrstvwxyz';

export type GenerationFileTokenSource = () => string;

export function createGenerationFileToken(): string {
  const bytes = crypto.randomBytes(3);
  return Array.from(
    bytes,
    (byte) => GENERATION_FILE_TOKEN_ALPHABET[byte & 31]
  ).join('');
}

export function isGenerationFileToken(value: string): boolean {
  return value.length === 3 &&
    [...value].every((character) =>
      GENERATION_FILE_TOKEN_ALPHABET.includes(character)
    );
}
