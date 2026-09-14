module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: ['test/.*\\.spec\\.ts$', 'src/.*\\.test\\.ts$'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleNameMapper: {
    '^expo-server-sdk$': '<rootDir>/test/mocks/expo-server-sdk.ts',
  },
};
