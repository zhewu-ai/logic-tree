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
  <div class="app" @keydown="handleKeydown">
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
</style>
