import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import tailwind from 'eslint-plugin-tailwindcss'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'server-dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      ...tailwind.configs['flat/recommended'],
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    settings: {
      tailwindcss: {
        // Provide an empty config object to suppress "Cannot resolve default tailwindcss config path" warnings
        // This tells the plugin not to try auto-detecting the config path
        config: {},
        // Whitelist all custom Shadcn UI theme classes using CSS variables
        whitelist: [
          // Match any class using these color tokens (e.g., bg-primary, text-muted-foreground, etc.)
          '(bg|text|border|ring|fill|stroke|outline|shadow|divide|from|via|to|placeholder|decoration|caret|accent)-(background|foreground|card|card-foreground|popover|popover-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|accent|accent-foreground|destructive|destructive-foreground|border|input|ring|chart-[1-5]|sidebar|sidebar-foreground|sidebar-primary|sidebar-primary-foreground|sidebar-accent|sidebar-accent-foreground|sidebar-border|sidebar-active-bg|sidebar-ring|surface-elevated|surface-border)(\\/\\d+)?',
        ],
      },
    },
    rules: {
      // Allow unused variables with underscore prefix (for intentionally unused parameters)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Tailwind CSS rules
      // The no-custom-classname rule produces false positives with Shadcn UI's custom theme classes
      // even with whitelist, so disable it until better Tailwind v4 support is available
      'tailwindcss/no-custom-classname': 'off',
      // These rules provide value without requiring full config resolution
      'tailwindcss/enforces-negative-arbitrary-values': 'warn',
      'tailwindcss/enforces-shorthand': 'warn',
      'tailwindcss/no-arbitrary-value': 'off', // Keep off - arbitrary values are valid
      // Disable rules that require full Tailwind v4 config resolution (not yet working)
      'tailwindcss/classnames-order': 'off',
      'tailwindcss/no-contradicting-classname': 'off',
      'tailwindcss/no-unnecessary-arbitrary-value': 'off',
    },
  },
  {
    files: ['playwright.config.ts', 'e2e/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='button']",
          message:
            'Use the local shadcn-style Button primitive from packages/studio/src/ui instead of a raw browser button in app or feature code.',
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message:
            'Use the local shadcn-style Input primitive from packages/studio/src/ui instead of a raw browser input in app or feature code.',
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            'Use the local shadcn-style Select primitive from packages/studio/src/ui instead of a raw browser select in app or feature code.',
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message:
            'Use the local shadcn-style Textarea primitive from packages/studio/src/ui instead of a raw browser textarea in app or feature code.',
        },
        {
          selector: "JSXOpeningElement[name.name='dialog']",
          message:
            'Use the local shadcn-style Dialog primitive from packages/studio/src/ui instead of a raw browser dialog in app or feature code.',
        },
      ],
    },
  },
])
