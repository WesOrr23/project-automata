import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration: https://vite.dev/config/
export default defineConfig({
  // Enable React plugin to handle JSX/TSX files
  plugins: [react()],

  // Vitest (testing framework) configuration
  test: {
    // Use describe(), it(), expect() without importing them
    globals: true,

    // Use Node environment for engine tests (pure TypeScript logic)
    // When we add React component tests later, we'll need 'jsdom'
    environment: 'node',
  },
})
