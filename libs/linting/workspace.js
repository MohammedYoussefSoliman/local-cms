import node from './node.js';
import react from './react.js';

/**
 * The whole workspace in one flat config.
 *
 * ESLint 9 resolves `eslint.config.*` from the **current working directory**,
 * not from the directory of the file being linted. Anything that lints from
 * the repo root — lint-staged in the pre-commit hook, an editor integration,
 * CI — therefore needs a root config; per-package configs alone are invisible
 * to it. This file is that config, and it is the only one, so the rules a
 * commit is checked against cannot drift from the rules `pnpm lint` applies.
 */

/**
 * Restricts a shared config array to one set of paths.
 *
 * Config objects that carry *only* `ignores` are global ignores; giving them
 * `files` would silently demote them to ordinary scoped configs, so they are
 * dropped here and re-declared once at the bottom instead.
 */
function scope(configs, files) {
  return configs
    .filter((config) => {
      const keys = Object.keys(config);
      return !(keys.length === 1 && keys[0] === 'ignores');
    })
    .map((config) => ({ ...config, files }));
}

const NODE_PATHS = [
  'apps/api/**/*.ts',
  'libs/contracts/**/*.ts',
  'libs/database/**/*.ts',
  'libs/domain/**/*.ts',
];

const REACT_PATHS = ['apps/dashboard/**/*.{ts,tsx}', 'libs/ui/**/*.{ts,tsx}'];

export default [
  ...scope(node, NODE_PATHS),
  ...scope(react, REACT_PATHS),

  {
    // `handleHttpError` is the one place allowed to know about AxiosError —
    // it exists precisely so feature code never inspects axios internals.
    files: ['libs/ui/src/functions/handleHttpError.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // `config/axios.ts` creates axiosInstance, so it must import axios; its
    // test imports axios to spy on the refresh call.
    files: [
      'apps/dashboard/src/config/axios.ts',
      'apps/dashboard/src/config/axios.test.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },

  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'libs/database/src/migrations/**',
      '**/eslint.config.{js,mjs,cjs}',
      'libs/linting/*.js',
    ],
  },
];
