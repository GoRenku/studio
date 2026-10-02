import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const compat = new FlatCompat({ recommendedConfig: js.configs.recommended });

export default [
  { ignores: ['dist/**', 'node_modules/**', '*.config.*'] },
  ...compat.config({
    extends: ['eslint:recommended', 'prettier'],
    parser: '@typescript-eslint/parser',
    env: { node: true, es2022: true },
    rules: { 'no-unused-vars': 'off', 'no-nested-ternary': 'error', 'max-depth': ['error', 3] },
  }),
  { files: ['src/**/*.ts'] },
];
