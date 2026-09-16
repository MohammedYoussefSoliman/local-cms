import globals from 'globals';

import { base } from './base.js';

/** ESLint config for NestJS / Node packages. */
export default [
  ...base,
  {
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      // NestJS DI relies on parameter decorators and empty constructors.
      '@typescript-eslint/no-empty-function': [
        'error',
        { allow: ['constructors'] },
      ],
      // Entities and DTOs are classes by necessity; the `type`-over-interface
      // rule above still applies to plain shapes.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    // Decorated classes (entities, DTOs, controllers) need class syntax.
    files: ['**/*.entity.ts', '**/*.dto.ts'],
    rules: { '@typescript-eslint/consistent-type-definitions': 'off' },
  },
];
