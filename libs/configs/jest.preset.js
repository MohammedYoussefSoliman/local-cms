/** Shared Jest preset for Node/NestJS packages. */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.dto.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
};
