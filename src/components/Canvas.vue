<script setup lang="ts">
import { ref, watch, onMounted, markRaw } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import WindowNode from './nodes/WindowNode.vue'
import type { LogicNodeData, NodeType } from '../types'
import { NODE_TYPES } from '../types'
import { createNode, genId } from '../utils/treeUtils'
import { calcLayout } from '../utils/layout'
import type { Node, Edge, ViewportTransform, NodeChange, EdgeChange } from '@vue-flow/core'

const props = defineProps<{
  nodeMap: Map<string, LogicNodeData>
  treeVersion: number
}>()

const emit = defineEmits<{
  selectNode: [id: string | null]
  deleteNodes: [ids: string[]]
  deleted: []
}>()

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const nodeTypes = markRaw({ window: WindowNode })

// Track viewport transform for coordinate conversion
const viewport = ref<ViewportTransform>({ x: 0, y: 0, zoom: 1 })
const wrapperEl = ref<HTMLElement | null>(null)

// Connection → new node menu state
const connectMenu = ref<{ x: number; y: number; sourceId: string; sourceHandle?: string | null } | null>(null)
let connectSourceId: string | null = null
let connectSourceHandle: string | null = null
let justConnected = false

watch(() => props.treeVersion, () => recalcLayout())

function recalcLayout() {
  if (props.nodeMap.size === 0) {
    nodes.value = []
    edges.value = []
    return
  }
  const result = calcLayout(props.nodeMap)

  // Pin every node to its computed position so future layouts don't shift them
  for (const node of result.nodes) {
    const data = props.nodeMap.get(node.id)
    if (data && data.savedX === undefined) {
      data.savedX = node.position.x
      data.savedY = node.position.y
    }
  }

  nodes.value = result.nodes
  edges.value = result.edges
}

/** Convert screen coordinates to flow coordinates */
function screenToFlow(screenX: number, screenY: number) {
  const el = wrapperEl.value
  if (!el) return { x: screenX, y: screenY }
  const rect = el.getBoundingClientRect()
  return {
    x: (screenX - rect.left - viewport.value.x) / viewport.value.zoom,
    y: (screenY - rect.top - viewport.value.y) / viewport.value.zoom,
  }
}

function addNodeAt(type: NodeType, clientX: number, clientY: number) {
  const pos = screenToFlow(clientX, clientY)
  const def = NODE_TYPES.find((n) => n.type === type)
  const data = createNode(type, def?.label || type)
  data.savedX = Math.max(0, pos.x - 130)
  data.savedY = Math.max(0, pos.y - 30)
  props.nodeMap.set(data.id, data)
  recalcLayout()
}

// Sidebar drag onto wrapper (outside VueFlow element)
function onWrapperDragOver(e: DragEvent) { e.preventDefault() }

function onWrapperDrop(e: DragEvent) {
  e.preventDefault()
  const type = e.dataTransfer?.getData('logic-tree-type') as NodeType | undefined
  if (type) addNodeAt(type, e.clientX, e.clientY)
}

// Vue Flow emits viewport changes
function onViewportChange(v: ViewportTransform) {
  viewport.value = v
}

function onNodeClick({ node }: { node: Node }) {
  emit('selectNode', node.id)
}

function onPaneClick() {
  emit('selectNode', null)
}

/** Edge removed from v-model — sync back to nodeMap */
function onEdgesChange(changes: EdgeChange[]) {
  let changed = false
  for (const change of changes) {
    if (change.type !== 'remove') continue
    // Parse edge ID: 'e-{sourceId}-{targetId}'
    // Node IDs always contain 'node-', so split on the last '-node-' boundary
    const rest = change.id.startsWith('e-') ? change.id.slice(2) : change.id
    const sep = rest.lastIndexOf('-node-')
    if (sep === -1) continue
    const source = rest.slice(0, sep)
    const target = 'node-' + rest.slice(sep + 6)

    const targetData = props.nodeMap.get(target)
    if (!targetData) continue

    if (targetData.parentId === source) {
      const sourceData = props.nodeMap.get(source)
      if (sourceData) sourceData.children = sourceData.children.filter(c => c !== target)
      targetData.parentId = null
      targetData.branch = undefined
    } else if (targetData.extraParents?.includes(source)) {
      targetData.extraParents = targetData.extraParents.filter(p => p !== source)
    }
    changed = true
  }
  if (changed) {
    emit('deleted')
    recalcLayout()
  }
}

/** Sync Vue Flow node changes back to nodeMap */
function onNodesChange(changes: NodeChange[]) {
  const removedIds = changes
    .filter((c): c is { type: 'remove'; id: string } => c.type === 'remove')
    .map((c) => c.id)
  if (removedIds.length > 0) {
    emit('deleteNodes', removedIds)
  }
}

function onNodeDragStop({ node }: { node: Node }) {
  const data = props.nodeMap.get(node.id)
  if (data) {
    data.savedX = node.position.x
    data.savedY = node.position.y
  }
}

function onConnectStart(event: any) {
  connectSourceId = event?.nodeId || null
  connectSourceHandle = event?.handleId || null
}

function onConnectHandler(connection: any) {
  justConnected = true
  const targetData = props.nodeMap.get(connection.target)
  const sourceData = props.nodeMap.get(connection.source)
  if (targetData && sourceData) {
    if (targetData.parentId && targetData.parentId !== sourceData.id) {
      // Multi-parent: add as extra edge instead of overwriting
      if (!targetData.extraParents) targetData.extraParents = []
      if (!targetData.extraParents.includes(sourceData.id)) {
        targetData.extraParents.push(sourceData.id)
      }
    } else {
      // Normal tree connection
      if (targetData.parentId) {
        const oldParent = props.nodeMap.get(targetData.parentId)
        if (oldParent) {
          oldParent.children = oldParent.children.filter((c) => c !== targetData.id)
        }
      }
      targetData.parentId = sourceData.id
      if (!sourceData.children.includes(targetData.id)) {
        sourceData.children.push(targetData.id)
      }
    }
    // Set branch for condition node children
    const branchMatch = connection.sourceHandle?.match(/^branch-([a-z])$/)
    targetData.branch = branchMatch?.[1]
    recalcLayout()
  }
}

function onConnectEnd(event: any) {
  try {
    const conn = event?.connection
    if (!conn?.target && connectSourceId && !justConnected) {
      const ev = event?.event || event
      if (ev?.clientX != null) {
        connectMenu.value = { x: ev.clientX, y: ev.clientY, sourceId: connectSourceId, sourceHandle: connectSourceHandle }
      }
    }
  } finally {
    // Must always clean up, or Vue Flow keeps tracking the mouse
    connectSourceId = null
    connectSourceHandle = null
    justConnected = false
  }
}

function menuCreateNode(type: NodeType) {
  const menu = connectMenu.value
  if (!menu) return
  // Guard: prevent double-trigger
  connectMenu.value = null

  const def = NODE_TYPES.find((n) => n.type === type)
  const data = createNode(type, def?.label || type, menu.sourceId)

  // Assign branch if connecting from condition node
  const branchMatch = menu.sourceHandle?.match(/^branch-([a-z])$/)
  if (branchMatch) data.branch = branchMatch[1]

  // Add to nodeMap
  props.nodeMap.set(data.id, data)

  // Link parent → child
  const sourceData = props.nodeMap.get(menu.sourceId)
  if (sourceData) {
    sourceData.children.push(data.id)
  }

  recalcLayout()
}

onMounted(() => setTimeout(() => recalcLayout(), 100))
</script>

<template>
  <!-- wrapper receives sidebar drag & drop events that don't reach VueFlow -->
  <div
    ref="wrapperEl"
    class="canvas-wrapper"
    @dragover="onWrapperDragOver"
    @drop="onWrapperDrop"
  >
    <div v-if="nodes.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l4 8H8l4-8z"/>
          <path d="M12 11v10"/>
          <path d="M8 15a4 4 0 118 0"/>
        </svg>
      </div>
      <div class="empty-title">开始构建逻辑树</div>
      <div class="empty-hint">点击左侧面板的组件来添加节点</div>
      <div class="empty-steps">
        <div class="empty-step">1. 选择一个节点类型（页面、模块等）</div>
        <div class="empty-step">2. 编辑节点名称和描述</div>
        <div class="empty-step">3. 从节点右侧手柄拖拽连线建立关系</div>
      </div>
    </div>
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :default-viewport="{ x: 0, y: 0, zoom: 0.85 }"
      :min-zoom="0.1"
      :max-zoom="3"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :edges-deletable="true"
      :fit-view-on-init="false"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @node-drag-stop="onNodeDragStop"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @connect-start="onConnectStart"
      @connect="onConnectHandler"
      @connect-end="onConnectEnd"
      @viewport-change="onViewportChange"
    >
      <Background :variant="BackgroundVariant.Lines" :gap="30" :size="1" pattern-color="#e2e8f0" />
    </VueFlow>

    <!-- Connection → new node menu -->
    <div
      v-if="connectMenu"
      class="connect-menu"
      :style="{ left: connectMenu.x + 'px', top: connectMenu.y + 'px' }"
      @click.stop
    >
      <div class="connect-menu-title">新建气泡</div>
      <div class="connect-menu-grid">
        <button
          v-for="nt in NODE_TYPES"
          :key="nt.type"
          class="connect-menu-item"
          :style="{ '--accent': nt.color }"
          @click="menuCreateNode(nt.type)"
        >
          <span class="connect-menu-icon" v-html="nt.icon"></span>
          <span class="connect-menu-label">{{ nt.label }}</span>
        </button>
      </div>
    </div>
    <div v-if="connectMenu" class="connect-menu-backdrop" @click="connectMenu = null"></div>
  </div>
</template>

<style scoped>
.canvas-wrapper {
  flex: 1;
  height: 100%;
  position: relative;
  background: #f8fafc;
}
</style>

<style>
.vue-flow__background pattern line {
  stroke: #e2e8f0;
}

/* Large connection handles */
.vue-flow__handle {
  width: 15px !important;
  height: 15px !important;
  background: #ffffff !important;
  border: 3px solid #cbd5e1 !important;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important;
}
.vue-flow__handle.handle-amber {
  border-color: #f59e0b !important;
}
.vue-flow__handle.handle-slate {
  border-color: #94a3b8 !important;
}
.vue-flow__handle:hover {
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 4px rgba(99,102,241,0.2) !important;
}

/* Selected edge visual feedback */
.vue-flow__edge--selected .vue-flow__edge-path {
  stroke: #6366f1 !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.4));
}
.vue-flow__edge:hover .vue-flow__edge-path {
  stroke: #818cf8 !important;
  stroke-width: 2.5px !important;
  cursor: pointer;
}

/* Connection menu popup */
.connect-menu {
  position: fixed;
  z-index: 100;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  padding: 10px 12px;
  min-width: 180px;
  transform: translate(-50%, 8px);
}
.connect-menu-title {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  padding-left: 4px;
}
.connect-menu-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.connect-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.1s;
  font-family: inherit;
  text-align: left;
}
.connect-menu-item:hover {
  background: #f1f5f9;
}
.connect-menu-icon {
  display: flex;
  align-items: center;
  color: var(--accent);
}
.connect-menu-icon svg {
  display: block;
}
.connect-menu-label {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}
.connect-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 5;
  pointer-events: none;
  gap: 6px;
}
.empty-icon {
  margin-bottom: 8px;
  opacity: 0.5;
}
.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #94a3b8;
}
.empty-hint {
  font-size: 13px;
  color: #cbd5e1;
  margin-bottom: 16px;
}
.empty-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.empty-step {
  font-size: 12px;
  color: #cbd5e1;
  text-align: center;
}
</style>
