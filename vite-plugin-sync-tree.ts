import fs from 'fs'
import type { Plugin } from 'vite'

/**
 * Watches sync-output.json and pushes updates to the browser via Vite HMR WebSocket.
 * Claude Code writes to sync-output.json → browser auto-imports.
 */
export default function syncTreePlugin(): Plugin {
  const FILE = 'sync-output.json'

  return {
    name: 'sync-tree',
    configureServer(server) {
      if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]')
      fs.watch(FILE, () => {
        try {
          const raw = fs.readFileSync(FILE, 'utf-8').trim()
          if (!raw) return
          JSON.parse(raw) // validate
          server.ws.send('sync-tree:update', raw)
        } catch {
          // invalid JSON, skip
        }
      })
    },
  }
}
