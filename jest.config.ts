import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@crossborder/core$': '<rootDir>/packages/core/src/index.ts',
    '^@crossborder/core/(.*)$': '<rootDir>/packages/core/src/$1',
    '^@crossborder/network-adapters$': '<rootDir>/packages/network-adapters/src/index.ts',
    '^@crossborder/api-gateway$': '<rootDir>/packages/api-gateway/src/index.ts',
    '^@crossborder/sdk$': '<rootDir>/packages/sdk/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/index.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  verbose: true,
};

export default config;
