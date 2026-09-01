import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const commitHash = process.env.GITHUB_SHA?.slice(0, 7) ?? process.env.VITE_COMMIT_HASH ?? 'local'

export default defineConfig({
  plugins: [react()],
  base: '/stocks-dashboard/',
  define: {
    __APP_COMMIT__: JSON.stringify(commitHash),
  },
})
