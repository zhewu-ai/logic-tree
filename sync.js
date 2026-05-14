/**
 * LogicTree Sync Bridge
 *
 * Usage (in Claude Code):
 *   node sync.js read    → print the current tree JSON
 *   node sync.js write '[...]'  → write new tree JSON
 *   node sync.js prompt → generate an AI prompt from the tree
 *   node sync.js watch  → watch file and print on changes (for app hot-reload)
 */

import { readFileSync, writeFileSync, watchFile } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TREE_FILE = join(__dirname, 'logic-tree.json')

function read() {
  try {
    return JSON.parse(readFileSync(TREE_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function write(data) {
  writeFileSync(TREE_FILE, JSON.stringify(data, null, 2), 'utf-8')
  console.log('✅ logic-tree.json updated')
}

function generatePrompt() {
  const tree = read()
  return `我正在使用一个逻辑树编辑器来组织我的需求。请理解以下树状结构并基于它来回应：

\`\`\`json
${JSON.stringify(tree, null, 2)}
\`\`\`

请分析这个结构并根据我接下来的问题进行回复。你可以：
1. 指出结构中的问题或改进点
2. 基于这个结构生成代码
3. 建议如何扩展或修改
4. 返回一个JSON结构让我导入回编辑器（格式同上面的结构）`
}

const cmd = process.argv[2]
switch (cmd) {
  case 'read':
    console.log(JSON.stringify(read(), null, 2))
    break
  case 'write':
    write(JSON.parse(process.argv[3]))
    break
  case 'prompt':
    console.log(generatePrompt())
    break
  case 'watch':
    console.log('Watching logic-tree.json for changes...')
    watchFile(TREE_FILE, () => {
      const data = read()
      const count = Array.isArray(data) ? data.length : 0
      console.log(`[${new Date().toLocaleTimeString()}] Tree updated (${count} roots)`)
      console.log(JSON.stringify(data, null, 2))
    })
    break
  default:
    console.log('Usage: node sync.js <read|write|prompt|watch>')
}
