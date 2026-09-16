import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

import { base } from './base.js';

/** ESLint config for the React dashboard and shared UI lib. */
export default [
  ...base,
  {
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Enforced by .claude/rules/global-react-components.md
      'func-style': ['error', 'declaration', { allowArrowFunctions: false }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['default'],
              message:
                'Destructure from react instead of importing the default export.',
            },
            {
              name: 'axios',
              message:
                'Use axiosInstance from @/config — never import axios directly.',
            },
          ],
        },
      ],
    },
  },
];
