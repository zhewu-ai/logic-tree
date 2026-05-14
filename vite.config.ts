import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import syncTree from './vite-plugin-sync-tree'

// https://vite.dev/config/
export default defineConfig({
  base: '/logic-tree/',
  plugins: [vue(), syncTree()],
})
