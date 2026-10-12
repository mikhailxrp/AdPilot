import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	resolve: { tsconfigPaths: true },
	test: {
		environment: 'jsdom',
		// Playwright files must not be picked up by Vitest
		exclude: [...configDefaults.exclude, 'tests/e2e/**'],
	},
});
