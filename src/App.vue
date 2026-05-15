<script setup lang="ts">
import { ref, computed, reactive, watch, onUnmounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Canvas from './components/Canvas.vue'
import JsonPanel from './components/JsonPanel.vue'
import NodeEditor from './components/NodeEditor.vue'
import SketchEditor from './components/SketchEditor.vue'
import type { LogicNodeData, TreeNode, NodeType, TabInfo, SketchElement } from './types'
import { toTrees, genId, buildTree, cloneTree } from './utils/treeUtils'

const nodeMap = reactive<Map<string, LogicNodeData>>(new Map())
const treeVersion = ref(0)
const selectedNodeId = ref<string | null>(null)
const showEditorPanel = ref(true)
const showJsonPanel = ref(false)
const showIntro = ref(true)
const introLang = ref<'zh' | 'en'>('en')
const fileInputRef = ref<HTMLInputElement | null>(null)

const jsonCopied = ref(false)
const sketchEditorOpen = ref(false)
let copiedNode: TreeNode | null = null

// Tab state
const tabs = ref<TabInfo[]>([])
const activeTabId = ref('')
const editingTabId = ref<string | null>(null)
const editingTabName = ref('')

const selectedNode = computed(() =>
  selectedNodeId.value ? nodeMap.get(selectedNodeId.value) || null : null,
)
const trees = computed(() => toTrees(nodeMap))
const introIsZh = computed(() => introLang.value === 'zh')

function bump() { treeVersion.value++ }
function handleSelectNode(id: string | null) { selectedNodeId.value = id }

function handleOpenSketch() {
  if (selectedNode.value?.type === 'sketch') sketchEditorOpen.value = true
}
function handleCloseSketch() {
  sketchEditorOpen.value = false
}
function handleSketchUpdate(elements: SketchElement[], canvasW?: number, canvasH?: number) {
  const node = selectedNode.value
  if (node) {
    node.sketchElements = elements
    if (canvasW) node.sketchW = canvasW
    if (canvasH) node.sketchH = canvasH
    saveImmediate()
    bump()
  }
}

function handleNewCanvas() {
  if (nodeMap.size > 0 && !confirm('确定要清空当前画布吗？')) return
  nodeMap.clear()
  selectedNodeId.value = null
  saveImmediate()
  bump()
  // Update tab metadata
  const tab = tabs.value.find(t => t.id === activeTabId.value)
  if (tab) tab.selectedNodeId = null
  saveTabsMeta()
}

function handleAutoLayout() {
  for (const data of nodeMap.values()) {
    data.savedX = undefined
    data.savedY = undefined
  }
  bump()
}

function handleAddNode(type: NodeType, label?: string) {
  const id = genId()
  const data: LogicNodeData = {
    id,
    type,
    label: label || type,
    description: '',
    properties: {},
    parentId: null,
    children: [],
  }
  nodeMap.set(id, data)
  bump()
}

function handleUpdateNode(id: string, key: string, value: string) {
  const data = nodeMap.get(id)
  if (!data) return
  if (key.startsWith('properties.')) {
    const propKey = key.slice(11)
    data.properties[propKey] = value
  } else if (key === 'type') {
    (data as any).type = value
  } else if (key === 'label') {
    data.label = value
  } else if (key === 'description') {
    data.description = value
  }
  bump()
}

function handleKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  const selId = selectedNodeId.value
  if (!selId) return
  const selData = nodeMap.get(selId)
  if (!selData) return

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    const id = genId()
    const note: LogicNodeData = {
      id,
      type: 'note',
      label: '信息',
      description: '',
      properties: {},
      parentId: selId,
      children: [],
    }
    nodeMap.set(id, note)
    selData.children.push(id)
    selectedNodeId.value = id
    bump()
  }

  if (e.key === 'Tab') {
    e.preventDefault()
    const parentId = selData.parentId
    if (!parentId || !nodeMap.has(parentId)) return
    const id = genId()
    const note: LogicNodeData = {
      id,
      type: 'note',
      label: '信息',
      description: '',
      properties: {},
      parentId,
      children: [],
    }
    nodeMap.set(id, note)
    nodeMap.get(parentId)!.children.push(id)
    selectedNodeId.value = id
    bump()
  }
}

function handleImport(jsonStr: string) {
  try {
    const parsed = JSON.parse(jsonStr)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    nodeMap.clear()
    importTrees(items)
    saveImmediate()
  } catch {
    alert('JSON 格式错误')
  }
}

// Auto-import from Claude Code via Vite HMR
if (import.meta.hot) {
  import.meta.hot.on('sync-tree:update', (raw: string) => {
    handleImport(raw)
  })
}

function importTrees(trees: TreeNode[], parentId: string | null = null) {
  for (const t of trees) {
    const id = t.id || genId()
    nodeMap.set(id, {
      id,
      type: t.type,
      label: t.label,
      description: t.description || '',
      properties: t.properties || {},
      parentId,
      children: [],
      branch: t.branch,
      outputBranches: t.outputBranches,
      extraParents: t.extraParents?.length ? [...t.extraParents] : undefined,
      sketchElements: t.sketchElements ? t.sketchElements.map(s => ({...s})) : undefined,
      sketchW: t.sketchW,
      sketchH: t.sketchH,
    })
    // Keep parent's children array in sync
    if (parentId) {
      const parent = nodeMap.get(parentId)
      if (parent && !parent.children.includes(id)) {
        parent.children.push(id)
      }
    }
    importTrees(t.children || [], id)
  }
  bump()
}

function saveToFile() {
  const json = JSON.stringify(trees.value, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const tab = tabs.value.find(t => t.id === activeTabId.value)
  a.href = url; a.download = `${tab?.name || '画布'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function loadFromFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { try { handleImport(reader.result as string) } catch { alert('文件格式错误') } }
  reader.readAsText(file)
  input.value = ''
}

function copyJson() {
  navigator.clipboard.writeText(JSON.stringify(trees.value, null, 2)).then(() => {
    jsonCopied.value = true
    setTimeout(() => (jsonCopied.value = false), 1500)
  })
}

// --- Tab-aware localStorage persistence ---
const TABS_META_KEY = 'logic-tree-tabs'
function tabKey(id: string) { return `logic-tree-tab-${id}` }

let saveTimer: ReturnType<typeof setTimeout> | null = null

function saveTabsMeta() {
  try {
    localStorage.setItem(TABS_META_KEY, JSON.stringify({
      tabs: tabs.value,
      activeId: activeTabId.value,
    }))
  } catch (e) { console.warn('保存标签页元数据失败:', e) }
}

function loadTabsMeta(): { tabs: TabInfo[]; activeId: string } | null {
  try {
    const raw = localStorage.getItem(TABS_META_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveTabNodeMap(tabId: string) {
  try {
    const entries = Array.from(nodeMap.entries())
    localStorage.setItem(tabKey(tabId), JSON.stringify(entries))
    // Also persist the tab's selectedNodeId
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) tab.selectedNodeId = selectedNodeId.value
    saveTabsMeta()
  } catch (e) { console.warn('保存数据失败:', e) }
}

function loadTabNodeMap(tabId: string) {
  try {
    const raw = localStorage.getItem(tabKey(tabId))
    if (!raw) return
    const entries: [string, LogicNodeData][] = JSON.parse(raw)
    if (!Array.isArray(entries)) return
    for (const [id, data] of entries) {
      nodeMap.set(id, data)
    }
    bump()
  } catch { /* ignore corrupt data */ }
}

function saveImmediate() {
  if (!activeTabId.value) return
  saveTabNodeMap(activeTabId.value)
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  if (!activeTabId.value) return
  saveTimer = setTimeout(saveImmediate, 300)
}

// --- Tab switching ---
function switchTab(tabId: string) {
  if (tabId === activeTabId.value) return
  if (saveTimer) clearTimeout(saveTimer)
  // Save current tab
  saveTabNodeMap(activeTabId.value)
  // Clear and switch
  nodeMap.clear()
  selectedNodeId.value = null
  activeTabId.value = tabId
  loadTabNodeMap(tabId)
  // Restore selectedNodeId from tab metadata
  const tab = tabs.value.find(t => t.id === tabId)
  if (tab?.selectedNodeId && nodeMap.has(tab.selectedNodeId)) {
    selectedNodeId.value = tab.selectedNodeId
  }
  saveTabsMeta()
}

// --- Tab CRUD ---
function addTab() {
  // Save current before switching
  if (activeTabId.value) saveTabNodeMap(activeTabId.value)

  // Generate unique name
  let maxN = 0
  for (const t of tabs.value) {
    const m = t.name.match(/^画布 (\d+)$/)
    if (m) maxN = Math.max(maxN, parseInt(m[1]))
  }
  const id = `tab-${Date.now()}`
  const tab: TabInfo = { id, name: `画布 ${maxN + 1}`, selectedNodeId: null }
  tabs.value.push(tab)
  nodeMap.clear()
  selectedNodeId.value = null
  activeTabId.value = id
  saveTabsMeta()
  bump()
}

function closeTab(tabId: string) {
  if (tabs.value.length <= 1) return
  const idx = tabs.value.findIndex(t => t.id === tabId)
  if (idx === -1) return
  // Remove data from localStorage
  try { localStorage.removeItem(tabKey(tabId)) } catch {}

  // Remove from tabs array
  tabs.value.splice(idx, 1)

  if (tabId === activeTabId.value) {
    // Save current before switching
    saveTabNodeMap(activeTabId.value)
    nodeMap.clear()
    selectedNodeId.value = null
    const nextIdx = Math.min(idx, tabs.value.length - 1)
    activeTabId.value = tabs.value[nextIdx].id
    loadTabNodeMap(activeTabId.value)
    const tab = tabs.value.find(t => t.id === activeTabId.value)
    if (tab?.selectedNodeId && nodeMap.has(tab.selectedNodeId)) {
      selectedNodeId.value = tab.selectedNodeId
    }
  }
  saveTabsMeta()
}

function startRename(tabId: string, currentName: string) {
  editingTabId.value = tabId
  editingTabName.value = currentName
}

function confirmRename() {
  const name = editingTabName.value.trim()
  const tab = tabs.value.find(t => t.id === editingTabId.value)
  if (tab && name) tab.name = name
  editingTabId.value = null
  editingTabName.value = ''
  saveTabsMeta()
}

function cancelRename() {
  editingTabId.value = null
  editingTabName.value = ''
}

// --- Init ---
function initTabs() {
  // Migration from old single-canvas state
  const oldRaw = localStorage.getItem('logic-tree-state')
  const meta = loadTabsMeta()
  if (!meta && oldRaw) {
    // Migrate old data under a default tab
    const tabId = 'tab-default'
    try {
      localStorage.setItem(tabKey(tabId), oldRaw)
      localStorage.removeItem('logic-tree-state')
    } catch {}
    tabs.value = [{ id: tabId, name: '画布 1', selectedNodeId: null }]
    activeTabId.value = tabId
    loadTabNodeMap(tabId)
    saveTabsMeta()
    return
  }

  if (meta && meta.tabs.length > 0) {
    tabs.value = meta.tabs
    activeTabId.value = meta.tabs.some(t => t.id === meta.activeId) ? meta.activeId : meta.tabs[0].id
    loadTabNodeMap(activeTabId.value)
    const tab = tabs.value.find(t => t.id === activeTabId.value)
    if (tab?.selectedNodeId && nodeMap.has(tab.selectedNodeId)) {
      selectedNodeId.value = tab.selectedNodeId
    }
    return
  }

  // First launch: create default tab
  const id = 'tab-default'
  tabs.value = [{ id, name: '画布 1', selectedNodeId: null }]
  activeTabId.value = id
  saveTabsMeta()
}

initTabs()

// Auto-save on every nodeMap mutation
watch(nodeMap, scheduleSave, { deep: true })

// Save synchronously on page unload
window.addEventListener('beforeunload', saveImmediate)
onUnmounted(() => window.removeEventListener('beforeunload', saveImmediate))

// Window-level copy/paste (capture phase, before Vue Flow can intercept)
function onCopyPaste(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey
  if (!mod || (e.key !== 'c' && e.key !== 'C' && e.key !== 'v' && e.key !== 'V')) return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  if (mod && (e.key === 'c' || e.key === 'C')) {
    if (selectedNodeId.value) {
      e.preventDefault()
      e.stopPropagation()
      copiedNode = buildTree(nodeMap, selectedNodeId.value)
    }
    return
  }

  if (mod && (e.key === 'v' || e.key === 'V')) {
    if (copiedNode) {
      e.preventDefault()
      e.stopPropagation()
      const cloned = cloneTree(copiedNode)
      if (!cloned) return
      const parentId = selectedNodeId.value
      importTrees([cloned], parentId)
      selectedNodeId.value = cloned.id
      saveImmediate()
    }
    return
  }
}
window.addEventListener('keydown', onCopyPaste, true)
onUnmounted(() => window.removeEventListener('keydown', onCopyPaste, true))

/** Vue Flow removed nodes → sync our nodeMap */
function handleDeleteNodes(ids: string[]) {
  for (const id of ids) {
    const data = nodeMap.get(id)
    if (!data) continue
    // Remove from parent's children
    if (data.parentId) {
      const parent = nodeMap.get(data.parentId)
      if (parent) parent.children = parent.children.filter((c) => c !== id)
    }
    // Delete all descendants recursively
    // Clean up extra parents (remove this node from other nodes' extraParents)
    for (const [, nd] of nodeMap) {
      if (nd.extraParents?.includes(id)) {
        nd.extraParents = nd.extraParents.filter(p => p !== id)
      }
    }
    function deleteSubtree(nodeId: string) {
      const n = nodeMap.get(nodeId)
      if (!n) return
      for (const childId of [...n.children]) deleteSubtree(childId)
      nodeMap.delete(nodeId)
    }
    deleteSubtree(id)
  }
  if (selectedNodeId.value && ids.includes(selectedNodeId.value)) {
    selectedNodeId.value = null
  }
  saveImmediate()
  bump()
}
</script>

<template>
  <div v-if="showIntro" class="intro-page">
    <header class="intro-header">
      <div class="intro-logo">
        <span class="intro-mark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="4" r="2.5"/>
            <circle cx="5" cy="18" r="2.5"/>
            <circle cx="19" cy="18" r="2.5"/>
            <path d="M10 6.5L7 16"/>
            <path d="M14 6.5L17 16"/>
          </svg>
        </span>
        <span>LogicTree</span>
      </div>
      <div class="intro-actions">
        <div class="language-switch" aria-label="Language switch">
          <button :class="{ active: introLang === 'en' }" @click="introLang = 'en'">EN</button>
          <button :class="{ active: introLang === 'zh' }" @click="introLang = 'zh'">中文</button>
        </div>
        <button class="intro-open-btn" @click="showIntro = false">
          {{ introIsZh ? '进入工具' : 'Open App' }}
        </button>
      </div>
    </header>

    <main class="intro-main">
      <section class="intro-hero">
        <div class="intro-copy">
          <p class="intro-kicker">
            {{ introIsZh ? 'AI 协作前的结构化表达工具' : 'Structured thinking before AI execution' }}
          </p>
          <h1>
            {{ introIsZh ? '把复杂想法整理成 AI 和人都能读懂的逻辑树。' : 'Turn complex ideas into logic trees that humans and AI can both understand.' }}
          </h1>
          <p class="intro-lead">
            {{ introIsZh
              ? 'LogicTree 把产品想法、需求拆解、条件分支、页面结构和交互草图放到同一张可编辑画布里，让沟通从长文本变成清晰的结构。'
              : 'LogicTree brings product ideas, requirement breakdowns, decision branches, page structures, and rough interaction sketches into one editable canvas, so planning becomes visible before implementation starts.' }}
          </p>
          <div class="intro-cta-row">
            <button class="intro-primary" @click="showIntro = false">
              {{ introIsZh ? '开始使用 LogicTree' : 'Start Using LogicTree' }}
            </button>
            <a class="intro-secondary" href="https://github.com/zhewu-ai/logic-tree" target="_blank" rel="noreferrer">
              {{ introIsZh ? '查看 GitHub' : 'View on GitHub' }}
            </a>
          </div>
        </div>

        <div class="intro-visual" aria-hidden="true">
          <div class="visual-toolbar">
            <span></span><span></span><span></span>
            <strong>{{ introIsZh ? '产品逻辑画布' : 'Product logic canvas' }}</strong>
          </div>
          <div class="visual-canvas">
            <div class="visual-node node-main">{{ introIsZh ? 'AI 产品想法' : 'AI product idea' }}</div>
            <div class="visual-line visual-line-a"></div>
            <div class="visual-line visual-line-b"></div>
            <div class="visual-line visual-line-c"></div>
            <div class="visual-node node-a">{{ introIsZh ? '需求拆解' : 'Requirements' }}</div>
            <div class="visual-node node-b">{{ introIsZh ? '条件分支' : 'Decisions' }}</div>
            <div class="visual-node node-c">{{ introIsZh ? '界面草图' : 'UI sketch' }}</div>
            <div class="visual-sketch">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </section>

      <section class="intro-section">
        <div class="section-heading">
          <p>{{ introIsZh ? '解决的痛点' : 'Pain Points' }}</p>
          <h2>{{ introIsZh ? '长聊天和散文档，很难承载复杂逻辑。' : 'Long chats and scattered docs are weak containers for complex logic.' }}</h2>
        </div>
        <div class="pain-grid">
          <article>
            <span>01</span>
            <h3>{{ introIsZh ? '上下文容易丢失' : 'Context gets lost' }}</h3>
            <p>{{ introIsZh ? '多轮 AI 对话后，需求、判断条件和设计意图会散落在不同消息里。' : 'After several AI conversations, requirements, conditions, and intent are spread across disconnected messages.' }}</p>
          </article>
          <article>
            <span>02</span>
            <h3>{{ introIsZh ? '结构不够可见' : 'Structure stays hidden' }}</h3>
            <p>{{ introIsZh ? '页面、模块、组件、动作和分支混在文字里，人和 AI 都容易理解偏差。' : 'Pages, modules, components, actions, and branches are mixed into text, which makes misunderstanding likely.' }}</p>
          </article>
          <article>
            <span>03</span>
            <h3>{{ introIsZh ? '图和 AI 之间断开' : 'Diagrams are not AI-ready' }}</h3>
            <p>{{ introIsZh ? '普通画图工具适合展示，但不适合作为 AI 能直接读取、修改和生成的结构化上下文。' : 'Drawing tools are good for presentation, but they rarely become structured context that AI can read, modify, and generate.' }}</p>
          </article>
        </div>
      </section>

      <section class="intro-section intro-split">
        <div class="section-heading">
          <p>{{ introIsZh ? '核心价值' : 'Core Value' }}</p>
          <h2>{{ introIsZh ? '先把逻辑整理清楚，再让 AI 执行。' : 'Clarify the logic first, then let AI execute.' }}</h2>
        </div>
        <div class="feature-list">
          <div>
            <h3>{{ introIsZh ? '可视化逻辑树' : 'Visual logic tree' }}</h3>
            <p>{{ introIsZh ? '用节点和连线表达产品结构、用户路径、业务规则和执行动作。' : 'Use nodes and links to express product structure, user journeys, business rules, and execution steps.' }}</p>
          </div>
          <div>
            <h3>{{ introIsZh ? 'AI 友好的 JSON 结构' : 'AI-friendly JSON structure' }}</h3>
            <p>{{ introIsZh ? '画布可以导出为结构化数据，让 AI 不必猜截图或长文本背后的真实关系。' : 'Export the canvas as structured data so AI does not need to guess relationships from screenshots or long prose.' }}</p>
          </div>
          <div>
            <h3>{{ introIsZh ? '草图和逻辑放在一起' : 'Sketches connected to logic' }}</h3>
            <p>{{ introIsZh ? '在节点里记录界面草图、布局想法和交互说明，让早期设计更容易传达。' : 'Keep rough UI sketches, layout ideas, and interaction notes connected to the exact logic they explain.' }}</p>
          </div>
        </div>
      </section>
    </main>
  </div>

  <div v-else class="app" @keydown="handleKeydown">
    <Sidebar @add-node="handleAddNode" />

    <div class="main">
      <!-- Top nav bar -->
      <header class="topnav">
        <div class="topnav-left">
          <span class="topnav-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px">
              <circle cx="12" cy="4" r="2.5"/>
              <circle cx="5" cy="18" r="2.5"/>
              <circle cx="19" cy="18" r="2.5"/>
              <path d="M10 6.5L7 16"/>
              <path d="M14 6.5L17 16"/>
            </svg>
            AI节点交互看板
          </span>
          <span class="topnav-badge">结构化交互</span>
        </div>
        <div class="topnav-center">
          <button class="topnav-btn" @click="saveToFile">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 2v12"/>
              <path d="M4 10l6 6 6-6"/>
              <path d="M3 17h14"/>
            </svg>
            导出
          </button>
          <button class="topnav-btn" @click="fileInputRef?.click()">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 14V2"/>
              <path d="M4 8l6-6 6 6"/>
              <path d="M3 17h14"/>
            </svg>
            导入
          </button>
          <input ref="fileInputRef" type="file" accept=".json" style="display:none" @change="loadFromFile" />
          <button class="topnav-btn" @click="copyJson">
            <svg v-if="!jsonCopied" width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="3" width="10" height="14" rx="1.5"/>
              <path d="M7 7h6M7 10h6M7 13h4"/>
            </svg>
            <svg v-else width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 10l4 4 8-8"/>
            </svg>
            {{ jsonCopied ? '已复制' : '复制 JSON' }}
          </button>
          <div class="topnav-divider"></div>
          <button class="topnav-btn topnav-accent" @click="handleAutoLayout">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="10" cy="5" r="2"/>
              <circle cx="5" cy="15" r="2"/>
              <circle cx="15" cy="15" r="2"/>
              <path d="M8 6.5l-2 7"/>
              <path d="M12 6.5l2 7"/>
            </svg>
            自动排列
          </button>
          <button class="topnav-btn topnav-danger" @click="handleNewCanvas">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="2" width="12" height="16" rx="2"/>
              <path d="M10 7v6M7 10h6"/>
            </svg>
            新画布
          </button>
        </div>
        <div class="topnav-right">
          <button class="topnav-btn topnav-toggle" @click="showIntro = true">
            {{ introIsZh ? '简介' : 'About' }}
          </button>
          <button class="topnav-btn topnav-toggle" @click="showEditorPanel = !showEditorPanel">
            {{ showEditorPanel ? '▸ 属性' : '◂ 属性' }}
          </button>
          <button class="topnav-btn topnav-toggle" @click="showJsonPanel = !showJsonPanel">
            {{ showJsonPanel ? '▸ JSON' : '◂ JSON' }}
          </button>
        </div>
      </header>

      <!-- Tab bar -->
      <div class="tab-bar">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: tab.id === activeTabId }"
          @click="switchTab(tab.id)"
        >
          <input
            v-if="editingTabId === tab.id"
            v-model="editingTabName"
            class="tab-rename-input"
            @keydown.enter="confirmRename"
            @keydown.escape="cancelRename"
            @blur="confirmRename"
            @click.stop
          />
          <span v-else class="tab-name" @dblclick="startRename(tab.id, tab.name)">{{ tab.name }}</span>
          <button
            v-if="tabs.length > 1"
            class="tab-close"
            @click.stop="closeTab(tab.id)"
          >×</button>
        </div>
        <button class="tab-add" @click="addTab" title="新建画布">+</button>
      </div>

      <!-- Main content -->
      <div class="content">
        <div v-if="sketchEditorOpen && selectedNode?.type === 'sketch'" class="sketch-view">
          <div class="sketch-back-bar">
            <button class="sketch-back-btn" @click="handleCloseSketch">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l-6 6 6 6"/></svg>
              返回树视图
            </button>
            <span class="sketch-back-title">{{ selectedNode.label }} — 绘制草图</span>
          </div>
          <SketchEditor
            :elements="selectedNode.sketchElements || []"
            :node-id="selectedNode.id"
            :canvas-w="selectedNode.sketchW ?? 700"
            :canvas-h="selectedNode.sketchH ?? 500"
            @update="handleSketchUpdate"
          />
        </div>
        <Canvas
          v-else
          :key="activeTabId"
          :node-map="nodeMap"
          :tree-version="treeVersion"
          @select-node="handleSelectNode"
          @delete-nodes="handleDeleteNodes"
          @deleted="saveImmediate"
        />

        <Transition name="slide">
          <div v-if="showEditorPanel" class="editor-panel">
            <div class="editor-panel-title">属性编辑</div>
            <NodeEditor
              :node="selectedNode"
              @update="handleUpdateNode"
              @open-sketch="handleOpenSketch"
            />
          </div>
        </Transition>
      </div>
    </div>

    <Transition name="slide-r">
      <JsonPanel v-if="showJsonPanel" :trees="trees" @import="handleImport" />
    </Transition>
  </div>
</template>

<style scoped>
.intro-page {
  min-height: 100vh;
  overflow-y: auto;
  background: #f6f8fb;
  color: #182033;
}

.intro-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 68px;
  padding: 0 40px;
  background: rgba(246, 248, 251, 0.94);
  border-bottom: 1px solid #dbe2ea;
  backdrop-filter: blur(14px);
}

.intro-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 800;
  color: #101828;
}

.intro-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #182033;
  color: #8ee5d1;
}

.intro-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.language-switch {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 3px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
}

.language-switch button {
  min-width: 50px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.language-switch button.active {
  background: #182033;
  color: #ffffff;
}

.intro-open-btn,
.intro-primary,
.intro-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 750;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}

.intro-open-btn {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid #182033;
  background: #182033;
  color: #ffffff;
}

.intro-main {
  max-width: 1180px;
  margin: 0 auto;
  padding: 72px 28px 84px;
}

.intro-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(420px, 0.9fr);
  align-items: center;
  gap: 56px;
  min-height: calc(100vh - 168px);
}

.intro-copy {
  max-width: 660px;
}

.intro-kicker,
.section-heading p {
  margin-bottom: 14px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
}

.intro-copy h1 {
  margin: 0;
  max-width: 780px;
  color: #101828;
  font-size: 58px;
  line-height: 1.04;
  font-weight: 850;
  letter-spacing: 0;
}

.intro-lead {
  margin-top: 22px;
  max-width: 620px;
  color: #475467;
  font-size: 19px;
  line-height: 1.68;
}

.intro-cta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 32px;
}

.intro-primary {
  padding: 0 20px;
  border: 1px solid #182033;
  background: #182033;
  color: #ffffff;
  box-shadow: 0 14px 30px rgba(24, 32, 51, 0.18);
}

.intro-secondary {
  padding: 0 18px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #182033;
}

.intro-visual {
  min-height: 440px;
  overflow: hidden;
  border: 1px solid #d1d9e6;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(16, 24, 40, 0.14);
}

.visual-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid #e2e8f0;
  color: #475467;
  font-size: 12px;
}

.visual-toolbar span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
}

.visual-toolbar span:nth-child(2) {
  background: #f59e0b;
}

.visual-toolbar span:nth-child(3) {
  margin-right: 8px;
  background: #22c55e;
}

.visual-toolbar strong {
  font-weight: 750;
}

.visual-canvas {
  position: relative;
  height: 396px;
  background:
    linear-gradient(#edf2f7 1px, transparent 1px),
    linear-gradient(90deg, #edf2f7 1px, transparent 1px);
  background-size: 28px 28px;
}

.visual-node {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 132px;
  height: 48px;
  padding: 0 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #182033;
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.1);
}

.node-main {
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  border-color: #182033;
  background: #182033;
  color: #ffffff;
}

.node-a {
  top: 174px;
  left: 34px;
}

.node-b {
  top: 174px;
  left: 50%;
  transform: translateX(-50%);
  border-color: #14b8a6;
  background: #ecfeff;
}

.node-c {
  top: 174px;
  right: 34px;
}

.visual-line {
  position: absolute;
  height: 2px;
  background: #94a3b8;
  transform-origin: left center;
}

.visual-line-a {
  top: 142px;
  left: 50%;
  width: 170px;
  transform: rotate(145deg);
}

.visual-line-b {
  top: 96px;
  left: 50%;
  width: 78px;
  transform: rotate(90deg);
}

.visual-line-c {
  top: 142px;
  left: 50%;
  width: 170px;
  transform: rotate(35deg);
}

.visual-sketch {
  position: absolute;
  right: 42px;
  bottom: 34px;
  width: 184px;
  height: 96px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff7ed;
}

.visual-sketch span {
  position: absolute;
  border: 1px solid #fb923c;
  border-radius: 5px;
  background: rgba(251, 146, 60, 0.12);
}

.visual-sketch span:nth-child(1) {
  top: 16px;
  left: 16px;
  width: 56px;
  height: 58px;
}

.visual-sketch span:nth-child(2) {
  top: 16px;
  right: 16px;
  width: 78px;
  height: 22px;
}

.visual-sketch span:nth-child(3) {
  right: 16px;
  bottom: 18px;
  width: 78px;
  height: 28px;
}

.intro-section {
  padding: 72px 0 0;
}

.section-heading {
  max-width: 760px;
}

.section-heading h2 {
  color: #101828;
  font-size: 34px;
  line-height: 1.18;
  letter-spacing: 0;
}

.pain-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 28px;
}

.pain-grid article,
.feature-list > div {
  border: 1px solid #dbe2ea;
  border-radius: 8px;
  background: #ffffff;
  padding: 24px;
}

.pain-grid span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 28px;
  margin-bottom: 22px;
  border-radius: 6px;
  background: #e0f2fe;
  color: #075985;
  font-size: 12px;
  font-weight: 850;
}

.pain-grid h3,
.feature-list h3 {
  margin: 0 0 10px;
  color: #182033;
  font-size: 18px;
}

.pain-grid p,
.feature-list p {
  color: #5f6c80;
  font-size: 15px;
  line-height: 1.62;
}

.intro-split {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 32px;
  align-items: start;
}

.feature-list {
  display: grid;
  gap: 14px;
}

.app {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: #f8fafc;
  color: #1e293b;
  overflow: hidden;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Top nav */
.topnav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 48px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  gap: 12px;
  flex-shrink: 0;
}
.topnav-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.topnav-brand {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
}
.topnav-badge {
  font-size: 9px;
  background: #eef2ff;
  color: #6366f1;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.topnav-center {
  display: flex;
  gap: 4px;
}
.topnav-right {
  display: flex;
}
.topnav-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.topnav-btn:hover {
  background: #eef2ff;
  border-color: #6366f1;
  color: #6366f1;
}
.topnav-toggle {
  font-size: 11px;
}
.topnav-accent {
  border-color: #c7d2fe;
  color: #4f46e5;
}
.topnav-accent:hover {
  background: #eef2ff;
  border-color: #6366f1;
}
.topnav-danger {
  color: #ef4444;
}
.topnav-danger:hover {
  background: #fef2f2;
  border-color: #ef4444;
  color: #dc2626;
}
.topnav-divider {
  width: 1px;
  height: 20px;
  background: #e2e8f0;
  margin: 0 4px;
}

/* Tab bar */
.tab-bar {
  display: flex;
  align-items: center;
  height: 34px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 8px;
  gap: 2px;
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
}
.tab-bar::-webkit-scrollbar { height: 0; }
.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-bottom: none;
  transition: background 0.1s;
  position: relative;
  top: 1px;
}
.tab-item:hover {
  background: #e2e8f0;
  color: #334155;
}
.tab-item.active {
  background: #ffffff;
  color: #1e293b;
  font-weight: 600;
  border-color: #e2e8f0;
}
.tab-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s;
  padding: 0;
}
.tab-item:hover .tab-close {
  opacity: 1;
}
.tab-close:hover {
  background: #fee2e2;
  color: #ef4444;
}
.tab-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
}
.tab-add:hover {
  background: #e2e8f0;
  color: #1e293b;
}
.tab-rename-input {
  font-size: 12px;
  border: 1px solid #6366f1;
  border-radius: 3px;
  outline: none;
  padding: 1px 4px;
  width: 100px;
  font-family: inherit;
  background: #ffffff;
}

/* Content area */
.content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Editor panel */
.editor-panel {
  width: 280px;
  background: #ffffff;
  border-left: 1px solid #e2e8f0;
  overflow-y: auto;
  flex-shrink: 0;
}
.editor-panel-title {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 14px 16px 0;
}

/* Slide transition */
.slide-enter-active, .slide-leave-active {
  transition: width 0.2s ease, opacity 0.15s ease;
  overflow: hidden;
}
.slide-enter-from, .slide-leave-to {
  width: 0 !important;
  opacity: 0;
  padding: 0;
}

.slide-r-enter-active, .slide-r-leave-active {
  transition: width 0.2s ease, opacity 0.15s ease;
  overflow: hidden;
}
.slide-r-enter-from, .slide-r-leave-to {
  width: 0 !important;
  opacity: 0;
  padding: 0;
}

/* Sketch editor view */
.sketch-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sketch-back-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.sketch-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.1s;
}
.sketch-back-btn:hover {
  background: #eef2ff;
  border-color: #6366f1;
  color: #6366f1;
}
.sketch-back-title {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

@media (max-width: 980px) {
  .intro-header {
    padding: 0 18px;
  }

  .intro-main {
    padding: 44px 18px 64px;
  }

  .intro-hero,
  .intro-split {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .intro-copy h1 {
    font-size: 42px;
  }

  .intro-visual {
    min-height: 380px;
  }

  .visual-canvas {
    height: 336px;
  }

  .pain-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .intro-header {
    height: auto;
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
  }

  .intro-actions,
  .intro-cta-row {
    width: 100%;
  }

  .language-switch {
    flex: 1;
  }

  .language-switch button {
    flex: 1;
  }

  .intro-open-btn,
  .intro-primary,
  .intro-secondary {
    flex: 1;
  }

  .intro-copy h1 {
    font-size: 34px;
  }

  .intro-lead {
    font-size: 16px;
  }

  .intro-cta-row {
    flex-direction: column;
  }

  .intro-visual {
    min-height: 320px;
  }

  .visual-canvas {
    height: 276px;
  }

  .visual-node {
    min-width: 104px;
    height: 42px;
    font-size: 11px;
  }

  .node-a {
    left: 16px;
  }

  .node-c {
    right: 16px;
  }

  .visual-line-a,
  .visual-line-c {
    width: 120px;
  }

  .visual-sketch {
    right: 18px;
    bottom: 20px;
    width: 150px;
  }

  .section-heading h2 {
    font-size: 27px;
  }
}
</style>
