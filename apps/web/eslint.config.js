import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'tailwind.config.ts', 'vite.config.ts', 'vitest.config.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Enforce no `any` — aligns with strict TypeScript requirement
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      // Allow `${number}` in template literals — coercion is well-defined
      // and the wrapping String() noise added nothing.
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber:  true,
        allowBoolean: true,
        allowNullish: true,
      }],
      // Conventional: `_var` signals intentionally-unused param/binding.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern:        '^_',
        varsIgnorePattern:        '^_',
        caughtErrorsIgnorePattern:'^_',
      }],
    },
  }
)
