<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { LogicNodeData, NodeTypeDef } from '../../types'
import { NODE_TYPE_MAP } from '../../types'

const props = defineProps<{
  id: string
  data: LogicNodeData
  selected: boolean
}>()

const def = computed<NodeTypeDef | undefined>(() => NODE_TYPE_MAP.get(props.data.type))

const dotColor = computed(() => def.value?.color || '#94a3b8')

const typeLabel = computed(() => {
  const map: Record<string, string> = {
    page: '主题',
    module: '模块',
    component: '组件',
    condition: 'If',
    action: '动作',
    note: '信息',
    sketch: '绘制',
  }
  return map[props.data.type] || props.data.type
})

// Compute sketch preview viewBox from element bounds to preserve aspect ratio
const sketchViewBox = computed(() => {
  const els = props.data.sketchElements
  if (!els || els.length === 0) return '0 0 100 80'
  let maxX = 0, maxY = 0
  for (const e of els) {
    const right = e.type === 'circle' ? (e.x + (e.r || 0)) : (e.x + (e.w || 0))
    const bottom = e.type === 'circle' ? (e.y + (e.r || 0)) : (e.y + (e.h || 0))
    if (right > maxX) maxX = right
    if (bottom > maxY) maxY = bottom
  }
  const pad = 20
  return `${-pad} ${-pad} ${maxX + pad * 2} ${maxY + pad * 2}`
})

// Custom resize logic
const nodeEl = ref<HTMLElement | null>(null)
let resizing = false
let startX = 0, startY = 0, startW = 200, startH = 0

function onResizeStart(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  resizing = true
  startX = e.clientX
  startY = e.clientY
  startW = nodeEl.value?.offsetWidth || 260
  startH = nodeEl.value?.offsetHeight || 100

  function onMouseMove(ev: MouseEvent) {
    if (!resizing || !nodeEl.value) return
    const w = Math.max(200, startW + (ev.clientX - startX))
    const h = Math.max(80, startH + (ev.clientY - startY))
    nodeEl.value.style.width = w + 'px'
    nodeEl.value.style.height = h + 'px'
    nodeEl.value.style.overflow = 'hidden'
  }

  function onMouseUp() {
    resizing = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function branchLetter(i: number): string {
  return String.fromCharCode(96 + i) // 1→a, 2→b, 3→c...
}
function branchHandleTop(index: number, total: number): string {
  return ((index / (total + 1)) * 100) + '%'
}
function branchHandleLabelTop(index: number, total: number): string {
  return ((index / (total + 1)) * 100 - 4) + '%'
}

onMounted(() => {
  const el = nodeEl.value?.querySelector('.wnode-desc-input') as HTMLTextAreaElement | null
  if (el) autoGrow(el)
})
</script>

<template>
  <div
    ref="nodeEl"
    class="wnode group"
    :class="{ 'wnode-selected': selected }"
    :style="{
      '--dot-color': dotColor,
      borderColor: selected ? dotColor : '#e2e8f0',
      boxShadow: selected
        ? `0 0 0 2px ${dotColor}20, 0 8px 30px rgba(0,0,0,0.12)`
        : '0 4px 16px rgba(0,0,0,0.08)',
    }"
  >
    <!-- Connection handles (left/right) — sized via vue-flow__handle CSS -->
    <Handle type="target" :position="Position.Left" class="handle-target" />

    <!-- Condition node: dynamic branch handles a, b, c... -->
    <template v-if="data.type === 'condition'">
      <template v-for="i in (data.outputBranches || 2)" :key="i">
        <Handle type="source" :position="Position.Right" :id="'branch-' + branchLetter(i)"
          class="handle-source" :class="selected ? 'handle-amber' : 'handle-slate'"
          :style="{ top: branchHandleTop(i, data.outputBranches || 2) }"
        />
        <span class="branch-handle-label" :style="{ top: branchHandleLabelTop(i, data.outputBranches || 2), color: '#f59e0b', right: '-22px' }">{{ branchLetter(i) }}</span>
      </template>
    </template>
    <!-- Other nodes: single source handle -->
    <template v-else>
      <Handle type="source" :position="Position.Right" class="handle-source handle-slate" />
    </template>

    <!-- Type strip -->
    <div class="wnode-type-strip" :style="{ backgroundColor: dotColor + '12' }">
      <span class="wnode-type-dot" :style="{ backgroundColor: dotColor }"></span>
      <span class="wnode-type-icon" v-html="def?.icon"></span>
      <span class="wnode-type-label" :style="{ color: dotColor }">{{ typeLabel }}</span>
    </div>

    <!-- Body -->
    <div class="wnode-body">
      <input
        :value="data.label"
        @input="(e: any) => { data.label = e.target.value }"
        @click.stop
        @mousedown.stop
        class="wnode-title-input"
        :style="{ color: dotColor }"
        placeholder="未命名"
      />
      <textarea
        :value="data.description"
        @input="(e: any) => { data.description = e.target.value; autoGrow(e.target) }"
        @click.stop
        @mousedown.stop
        class="wnode-desc-input"
        placeholder="添加描述..."
      ></textarea>

      <!-- Sketch mini preview — preserves canvas aspect ratio -->
      <div v-if="data.type === 'sketch' && data.sketchElements?.length" class="sketch-preview" @click.stop @mousedown.stop>
        <div class="sketch-preview-label">{{ data.sketchElements.length }} 个图形</div>
        <svg width="100%" height="60" :viewBox="sketchViewBox" preserveAspectRatio="xMidYMid meet" class="sketch-preview-svg">
          <rect v-for="el in data.sketchElements!.filter(e => e.type === 'rect')" :key="el.id"
            :x="el.x" :y="el.y" :width="el.w || 0" :height="el.h || 0"
            :fill="(el.color || '#6366f1') + '40'" :stroke="el.color || '#6366f1'" stroke-width="1.5" :rx="el.rx ?? 4" />
          <circle v-for="el in data.sketchElements!.filter(e => e.type === 'circle')" :key="el.id"
            :cx="el.x" :cy="el.y" :r="el.r || 0"
            :fill="(el.color || '#6366f1') + '40'" :stroke="el.color || '#6366f1'" stroke-width="1.5" />
          <text v-for="el in data.sketchElements!.filter(e => e.type === 'text')" :key="el.id"
            :x="el.x" :y="el.y" fill="#94a3b8" font-size="12" style="dominant-baseline:hanging">{{ el.text || '' }}</text>
        </svg>
      </div>
    </div>

    <!-- Resize handle -->
    <div class="wnode-resize-handle" @mousedown="onResizeStart"></div>
  </div>
</template>

<style scoped>
.wnode {
  min-width: 200px;
  width: 260px;
  background: #ffffff;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  overflow: visible;
  transition: border-color 0.2s, box-shadow 0.2s;
  cursor: grab;
  position: relative;
}
.wnode:hover {
  border-color: var(--dot-color, #6366f1);
}
.wnode:active {
  cursor: grabbing;
}
.wnode-selected {
  border-color: var(--dot-color, #6366f1) !important;
}

.wnode-type-strip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  user-select: none;
  border-radius: 14px 14px 0 0;
}
.wnode-type-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.wnode-type-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--dot-color);
}
.wnode-type-icon :deep(svg) {
  display: block;
}
.wnode-type-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.3px;
  opacity: 0.7;
  text-transform: uppercase;
}

.wnode-body {
  padding: 14px 14px 16px;
}

.wnode-title-input {
  background: transparent;
  border: none;
  outline: none;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  width: 100%;
  padding: 0;
  cursor: text;
}
.wnode-title-input:hover {
  background: #f8fafc;
  border-radius: 4px;
  padding: 3px 5px;
  margin: -3px -5px;
}
.wnode-title-input::placeholder {
  color: #94a3b8;
}
.wnode-title-input:focus {
  background: #f1f5f9;
  border-radius: 4px;
  padding: 3px 5px;
  margin: -3px -5px;
}

.wnode-desc-input {
  display: block;
  margin-top: 8px;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  width: 100%;
  padding: 0;
  resize: none;
  cursor: text;
  font-family: inherit;
  overflow-y: auto;
  max-height: 400px;
}
.wnode-desc-input::placeholder {
  color: #cbd5e1;
}
.wnode-desc-input:focus {
  background: #f8fafc;
  border-radius: 4px;
  padding: 4px 5px;
  margin: -4px -5px;
}

/* Sketch preview on card */
.sketch-preview {
  margin-top: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 4px 6px;
}
.sketch-preview-label {
  font-size: 9px;
  color: #94a3b8;
  font-weight: 600;
  margin-bottom: 3px;
}
.sketch-preview-svg {
  display: block;
}

/* Resize handle */
.wnode-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  opacity: 0;
  transition: opacity 0.15s;
}
.wnode-resize-handle::after {
  content: '';
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 8px;
  height: 8px;
  border-right: 2px solid #cbd5e1;
  border-bottom: 2px solid #cbd5e1;
  border-radius: 0 0 3px 0;
}
.wnode:hover .wnode-resize-handle {
  opacity: 1;
}

/* Branch handle labels (a/b) */
.branch-handle-label {
  position: absolute;
  font-size: 9px;
  font-weight: 800;
  pointer-events: none;
  user-select: none;
  line-height: 1;
}
</style>
