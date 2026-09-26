const preset = require('@cms/configs/jest.preset.js');

/**
 * The shared preset is referenced as a module rather than through Jest's
 * `preset` field: that field resolves a *package* containing `jest-preset.js`,
 * and `@cms/configs` is a file-list package with several configs in it.
 *
 * `rootDir` stays at the package root because the preset's ts-jest transform
 * points at `<rootDir>/tsconfig.json`.
 */
module.exports = {
  ...preset,
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@cms/([^/]+)$': '<rootDir>/../$1/src',
    '^@cms/([^/]+)/(.*)$': '<rootDir>/../$1/$2',
  },
};
