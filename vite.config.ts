import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration: https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site under https://wesorr23.github.io/project_automata/,
  // so all built asset URLs need this prefix. The `dev` server doesn't apply
  // it (it serves at /), so localhost workflow is unaffected.
  base: '/project_automata/',

  // Enable React plugin to handle JSX/TSX files
  plugins: [react()],

  // Vitest (testing framework) configuration
  test: {
    // Use describe(), it(), expect() without importing them
    globals: true,

    // Default to Node environment for engine tests (pure TypeScript logic).
    // React component / hook tests opt into jsdom via a per-file pragma:
    //   /** @vitest-environment jsdom */
    environment: 'node',
  },
})
