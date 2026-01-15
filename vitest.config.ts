import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './__tests__/setup.ts',
    exclude: [
      'node_modules/**',
      'e2e/**',
      'dist/**',
      'backend/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        'backend/',
        'dist/',
        '*.config.ts',
        '*.config.js',
      ],
    },
    // Increase timeout for integration tests
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mocks': path.resolve(__dirname, './__mocks__'),
    },
  },
});
