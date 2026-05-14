<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import type { SketchElement } from '../types'

const props = defineProps<{
  elements: SketchElement[]
  nodeId: string
  canvasW: number
  canvasH: number
}>()

const emit = defineEmits<{
  update: [elements: SketchElement[], canvasW: number, canvasH: number]
}>()

// --- Canvas size ---
const canvasPresets: { label: string; w: number; h: number }[] = [
  { label: 'iPhone', w: 375, h: 812 },
  { label: 'Android', w: 360, h: 780 },
  { label: 'iPad', w: 768, h: 1024 },
  { label: 'Web', w: 1280, h: 800 },
  { label: '方形', w: 500, h: 500 },
]
const canvasW = ref(props.canvasW)
const canvasH = ref(props.canvasH)
function applyPreset(p: { w: number; h: number }) {
  canvasW.value = p.w; canvasH.value = p.h
  fitZoom()
}
let customW = ref(String(props.canvasW))
let customH = ref(String(props.canvasH))
function applyCustomSize() {
  const w = parseInt(customW.value); const h = parseInt(customH.value)
  if (w > 0 && h > 0) { canvasW.value = w; canvasH.value = h; fitZoom() }
}

// --- Zoom ---
const zoom = ref(1)
function fitZoom() {
  const vw = 600; const vh = 400
  const scale = Math.min(vw / canvasW.value, vh / canvasH.value, 1)
  zoom.value = Math.round(scale * 100) / 100
}
function zoomIn() { zoom.value = Math.min(Math.round(zoom.value * 115) / 100, 3) }
function zoomOut() { zoom.value = Math.max(Math.round(zoom.value * 85) / 100, 0.15) }
function zoomReset() { fitZoom() }
function setZoom(val: number) { zoom.value = Math.max(0.15, Math.min(3, Math.round(val * 100) / 100)) }
onMounted(() => fitZoom())

// --- Local mutable copy of elements ---
const localElements = ref<SketchElement[]>(props.elements.map(e => ({ ...e })))

// --- Undo / Redo ---
const history = ref<SketchElement[][]>([props.elements.map(e => ({ ...e }))])
const historyIdx = ref(0)
const maxHistory = 50

function pushHistory(elements: SketchElement[]) {
  history.value = history.value.slice(0, historyIdx.value + 1)
  history.value.push(elements.map(e => ({ ...e })))
  if (history.value.length > maxHistory) history.value.shift()
  historyIdx.value = history.value.length - 1
}

function emitElements(newEls: SketchElement[]) {
  pushHistory(newEls)
  localElements.value = newEls
}

function save() {
  emit('update', localElements.value, canvasW.value, canvasH.value)
}

function undo() {
  if (historyIdx.value <= 0) return
  historyIdx.value--
  localElements.value = history.value[historyIdx.value].map(e => ({ ...e }))
}
function redo() {
  if (historyIdx.value >= history.length - 1) return
  historyIdx.value++
  localElements.value = history.value[historyIdx.value].map(e => ({ ...e }))
}

// Sync localElements when props change (e.g. re-opening the editor)
watch(() => props.elements, (val) => {
  localElements.value = val.map(e => ({ ...e }))
}, { deep: true })

// --- Tool & selection ---
const svgRef = ref<SVGSVGElement | null>(null)
const tool = ref<'select' | 'move' | 'rect' | 'circle'>('select')
const selectedId = ref<string | null>(null)
const editingTextId = ref<string | null>(null)
const editingText = ref('')
const textInputRef = ref<HTMLInputElement | null>(null)
const showSizeMenu = ref(false)
const showColorPicker = ref(false)

// Drawing & resizing state
let drawing = false
let drawStart = { x: 0, y: 0 }
let dragStartEl = { x: 0, y: 0, elX: 0, elY: 0 }
let resizing = false
let resizeHandle = ''
let resizeStart = { x: 0, y: 0, elX: 0, elY: 0, elW: 0, elH: 0, elR: 0 }

// Resize handle size
const HANDLE = 8

function getSvgPoint(e: MouseEvent) {
  const svg = svgRef.value
  if (!svg) return { x: 0, y: 0 }
  const rect = svg.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / zoom.value,
    y: (e.clientY - rect.top) / zoom.value,
  }
}

function genId() { return `sk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

function addElement(el: SketchElement) {
  emitElements([...localElements.value, el])
}
function updateElement(id: string, patch: Partial<SketchElement>) {
  emitElements(localElements.value.map(e => e.id === id ? { ...e, ...patch } : e))
}
function removeElement(id: string) {
  emitElements(localElements.value.filter(e => e.id !== id))
  if (selectedId.value === id) selectedId.value = null
}

// Mouse handlers
function onPointerDown(e: MouseEvent) {
  const pt = getSvgPoint(e)
  if (tool.value === 'select' || tool.value === 'move') {
    // Resize handles
    if (selectedId.value && tool.value === 'select') {
      const sel = localElements.value.find(e => e.id === selectedId.value)
      if (sel && getResizeHandle(sel, pt.x, pt.y)) {
        resizing = true; resizeHandle = getResizeHandle(sel, pt.x, pt.y)!
        resizeStart = { x: pt.x, y: pt.y, elX: sel.x, elY: sel.y, elW: sel.w || 0, elH: sel.h || 0, elR: sel.r || 0 }
        return
      }
    }
    // Move mode: click anywhere to drag selected element
    if (tool.value === 'move' && selectedId.value) {
      const sel = localElements.value.find(e => e.id === selectedId.value)
      if (sel) {
        dragStartEl = { x: pt.x, y: pt.y, elX: sel.x, elY: sel.y }
        drawing = true
        return
      }
    }
    // Select mode: click element to select then drag
    const hit = findElementAt(pt.x, pt.y)
    if (hit) {
      selectedId.value = hit.id
      dragStartEl = { x: pt.x, y: pt.y, elX: hit.x, elY: hit.y }
      drawing = true
    } else {
      selectedId.value = null
    }
    return
  }
  drawing = true
  drawStart = pt
  const id = genId()
  const color = '#6366f1'
  if (tool.value === 'rect') {
    addElement({ id, type: 'rect', x: pt.x, y: pt.y, w: 0, h: 0, text: '', color })
    selectedId.value = id
  } else if (tool.value === 'circle') {
    addElement({ id, type: 'circle', x: pt.x, y: pt.y, r: 0, text: '', color })
    selectedId.value = id
  }
}

function onPointerMove(e: MouseEvent) {
  const pt = getSvgPoint(e)

  // Resize mode
  if (resizing && selectedId.value) {
    const dx = pt.x - resizeStart.x
    const dy = pt.y - resizeStart.y
    const el = localElements.value.find(e => e.id === selectedId.value)
    if (!el) return
    if (el.type === 'rect') {
      const patch: any = {}
      if (resizeHandle.includes('e')) { patch.w = Math.max(10, resizeStart.elW + dx) }
      if (resizeHandle.includes('w')) { patch.x = resizeStart.elX + dx; patch.w = Math.max(10, resizeStart.elW - dx) }
      if (resizeHandle.includes('s')) { patch.h = Math.max(10, resizeStart.elH + dy) }
      if (resizeHandle.includes('n')) { patch.y = resizeStart.elY + dy; patch.h = Math.max(10, resizeStart.elH - dy) }
      updateElement(selectedId.value, patch)
    } else if (el.type === 'circle') {
      const d = Math.max(5, resizeStart.elR + (dx + dy) / 2)
      updateElement(selectedId.value, { r: d })
    }
    return
  }

  if (!drawing) return
  const sel = selectedId.value
  if (!sel) return
  if (tool.value === 'select' || tool.value === 'move') {
    updateElement(sel, {
      x: dragStartEl.elX + (pt.x - dragStartEl.x),
      y: dragStartEl.elY + (pt.y - dragStartEl.y),
    })
  } else if (tool.value === 'rect') {
    updateElement(sel, {
      x: Math.min(pt.x, drawStart.x), y: Math.min(pt.y, drawStart.y),
      w: Math.abs(pt.x - drawStart.x), h: Math.abs(pt.y - drawStart.y),
    })
  } else if (tool.value === 'circle') {
    const r = Math.sqrt((pt.x - drawStart.x) ** 2 + (pt.y - drawStart.y) ** 2)
    updateElement(sel, { x: drawStart.x, y: drawStart.y, r })
  }
}

function onPointerUp() {
  resizing = false
  if (!drawing) return
  drawing = false
}

function getResizeHandle(el: SketchElement, x: number, y: number): string | null {
  if (el.type === 'text') return null
  const l = el.type === 'circle' ? (el.x - (el.r || 0)) : el.x
  const t = el.type === 'circle' ? (el.y - (el.r || 0)) : el.y
  const r = el.type === 'circle' ? (el.x + (el.r || 0)) : (el.x + (el.w || 0))
  const b = el.type === 'circle' ? (el.y + (el.r || 0)) : (el.y + (el.h || 0))
  const hh = HANDLE
  const corners: [string, number, number][] = [
    ['nw', l, t], ['ne', r - hh, t], ['se', r - hh, b - hh], ['sw', l, b - hh],
  ]
  for (const [id, hx, hy] of corners) {
    if (x >= hx && x <= hx + hh && y >= hy && y <= hy + hh) return id
  }
  return null
}

function getHandleRect(el: SketchElement, pos: string): { x: number; y: number } {
  const h2 = HANDLE / 2
  const l = el.type === 'circle' ? (el.x - (el.r || 0)) : el.x
  const t = el.type === 'circle' ? (el.y - (el.r || 0)) : el.y
  const r = el.type === 'circle' ? (el.x + (el.r || 0)) : (el.x + (el.w || 0))
  const b = el.type === 'circle' ? (el.y + (el.r || 0)) : (el.y + (el.h || 0))
  const map: Record<string, { x: number; y: number }> = {
    nw: { x: l - h2, y: t - h2 },
    ne: { x: r - h2, y: t - h2 },
    se: { x: r - h2, y: b - h2 },
    sw: { x: l - h2, y: b - h2 },
  }
  return map[pos] || { x: 0, y: 0 }
}

function findElementAt(x: number, y: number): SketchElement | null {
  for (let i = localElements.value.length - 1; i >= 0; i--) {
    const e = localElements.value[i]
    const hidden = hiddenLayers.has(e.id)
    if (hidden) continue
    if (e.type === 'rect' && e.w && e.h) {
      if (x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) return e
    } else if (e.type === 'circle' && e.r) {
      const dx = x - e.x, dy = y - e.y
      if (dx * dx + dy * dy <= e.r * e.r) return e
    } else if (e.type === 'text') {
      if (x >= e.x && x <= e.x + 150 && y >= e.y - 18 && y <= e.y + 4) return e
    }
  }
  return null
}

function onDblClick(e: MouseEvent) {
  if (tool.value !== 'select') return
  const pt = getSvgPoint(e)
  const hit = findElementAt(pt.x, pt.y)
  if (hit) {
    editingTextId.value = hit.id
    editingText.value = hit.text || ''
    setTimeout(() => textInputRef.value?.focus(), 0)
  }
}

function confirmText() {
  if (editingTextId.value) {
    updateElement(editingTextId.value, { text: editingText.value })
    editingTextId.value = null; editingText.value = ''
  }
}

function onKeydown(e: KeyboardEvent) {
  if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (e.shiftKey) redo(); else undo()
    return
  }
  if (e.key === 'Escape') { confirmText(); selectedId.value = null; tool.value = 'select' }
}

function addText() {
  const id = genId()
  const el: SketchElement = { id, type: 'text', x: 100, y: 100, text: '文字', color: '#1e293b', fontSize: 16 }
  addElement(el)
  selectedId.value = id; editingTextId.value = id; editingText.value = '文字'
  setTimeout(() => textInputRef.value?.focus(), 0)
}

function deleteSelected() { if (selectedId.value) removeElement(selectedId.value) }

// --- Alignment ---
function getElBounds(el: SketchElement) {
  return el.type === 'circle'
    ? { l: el.x - (el.r || 0), t: el.y - (el.r || 0), r: el.x + (el.r || 0), b: el.y + (el.r || 0) }
    : { l: el.x, t: el.y, r: el.x + (el.w || 0), b: el.y + (el.h || 0) }
}
function alignCenterX() {
  if (!selectedId.value) return
  const el = localElements.value.find(e => e.id === selectedId.value)
  if (!el) return
  const b = getElBounds(el)
  const offset = (canvasW.value - (b.r - b.l)) / 2 - b.l
  updateElement(el.id, { x: el.x + offset })
}
function alignCenterY() {
  if (!selectedId.value) return
  const el = localElements.value.find(e => e.id === selectedId.value)
  if (!el) return
  const b = getElBounds(el)
  const offset = (canvasH.value - (b.b - b.t)) / 2 - b.t
  updateElement(el.id, { y: el.y + offset })
}
function alignLeft() {
  if (!selectedId.value) return
  const el = localElements.value.find(e => e.id === selectedId.value)
  if (!el) return
  if (el.type === 'circle') { updateElement(el.id, { x: (el.r || 0) }) }
  else { updateElement(el.id, { x: 0 }) }
}
function alignTop() {
  if (!selectedId.value) return
  const el = localElements.value.find(e => e.id === selectedId.value)
  if (!el) return
  if (el.type === 'circle') { updateElement(el.id, { y: (el.r || 0) }) }
  else { updateElement(el.id, { y: 0 }) }
}

// --- Layers panel ---
const hiddenLayers = reactive(new Set<string>())
const editingLayerId = ref<string | null>(null)
const editingLayerName = ref('')

function getLayerName(el: SketchElement): string {
  // Use an auto-generated name based on type and index
  return el.text || `${el.type === 'rect' ? '矩形' : el.type === 'circle' ? '圆形' : '文字'}`
}
function toggleLayerVisibility(id: string) {
  if (hiddenLayers.has(id)) hiddenLayers.delete(id)
  else hiddenLayers.add(id)
}
function startLayerRename(id: string) {
  editingLayerId.value = id
  editingLayerName.value = getLayerName(localElements.value.find(e => e.id === id)!)
}
function confirmLayerRename() {
  if (editingLayerId.value && editingLayerName.value.trim()) {
    updateElement(editingLayerId.value, { text: editingLayerName.value.trim() })
  }
  editingLayerId.value = null; editingLayerName.value = ''
}

function moveLayer(fromIdx: number, toIdx: number) {
  const arr = [...localElements.value]
  const [moved] = arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, moved)
  emitElements(arr)
}

// --- Color ---
const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#8b5cf6', '#1e293b', '#78716c', '#000000']
const customColor = ref('#6366f1')
function applyColor(c: string) {
  customColor.value = c
  if (selectedId.value) updateElement(selectedId.value, { color: c })
}

// Selected element data
const selectedEl = computed(() => localElements.value.find(e => e.id === selectedId.value))

import { onMounted } from 'vue'
</script>

<template>
  <div class="sketch-editor" @keydown="onKeydown" tabindex="0" @click="showSizeMenu = false; showColorPicker = false">
    <!-- Toolbar -->
    <div class="sketch-toolbar">
      <div class="sketch-toolbar-group">
        <button class="sketch-btn" @click="undo" :disabled="historyIdx <= 0" title="撤销 (Ctrl+Z)">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 10l5-6v4c4 0 7 2 8 6-2-3-5-4-8-4v4z"/></svg>
        </button>
        <button class="sketch-btn" @click="redo" :disabled="historyIdx >= history.length - 1" title="重做 (Ctrl+Shift+Z)">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 10l-5-6v4c-4 0-7 2-8 6 2-3 5-4 8-4v4z"/></svg>
        </button>
      </div>
      <div class="sketch-divider"></div>

      <div class="sketch-toolbar-group">
        <button class="sketch-btn" :class="{ active: tool === 'select' }" @click="tool = 'select'" title="选择 (V)">⤫</button>
        <button class="sketch-btn" :class="{ active: tool === 'move' }" @click="tool = 'move'" title="移动 — 只移动选中图层">✥</button>
        <button class="sketch-btn" :class="{ active: tool === 'rect' }" @click="tool = 'rect'" title="矩形 (R)">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1"/></svg>
        </button>
        <button class="sketch-btn" :class="{ active: tool === 'circle' }" @click="tool = 'circle'" title="圆形 (C)">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/></svg>
        </button>
        <button class="sketch-btn" @click="addText" title="文字 (T)">Ｔ</button>
        <button class="sketch-btn sketch-btn-danger" @click="deleteSelected" :disabled="!selectedId" title="删除选中图层">🗑</button>
      </div>
      <div class="sketch-divider"></div>
      <div class="sketch-toolbar-group">
        <button class="sketch-btn" @click="alignLeft" :disabled="!selectedId" title="左对齐">≡</button>
        <button class="sketch-btn" @click="alignCenterX" :disabled="!selectedId" title="水平居中">⏤</button>
        <button class="sketch-btn" @click="alignTop" :disabled="!selectedId" title="顶部对齐">⊟</button>
        <button class="sketch-btn" @click="alignCenterY" :disabled="!selectedId" title="垂直居中">⊞</button>
      </div>
      <div class="sketch-divider"></div>

      <div class="sketch-toolbar-group sketch-zoom-group">
        <button class="sketch-btn" @click="zoomOut" title="缩小">−</button>
        <input type="range" class="sketch-zoom-slider" min="15" max="300" :value="Math.round(zoom * 100)" @input="setZoom(parseInt(($event.target as HTMLInputElement).value) / 100)" />
        <button class="sketch-btn" @click="zoomIn" title="放大">+</button>
        <span class="sketch-zoom-label">{{ Math.round(zoom * 100) }}%</span>
        <button class="sketch-btn sketch-btn-sm" @click="zoomReset" title="适配画布">⊡</button>
      </div>
      <div class="sketch-divider"></div>

      <div class="sketch-toolbar-group sketch-size-group">
        <span class="sketch-size-label">{{ canvasW }}×{{ canvasH }}</span>
        <button class="sketch-btn sketch-btn-sm" @click.stop="showSizeMenu = !showSizeMenu" title="画布尺寸">▾</button>
        <div v-if="showSizeMenu" class="sketch-size-menu" @click.stop>
          <div class="sketch-size-menu-title">预设尺寸</div>
          <button v-for="p in canvasPresets" :key="p.label" class="sketch-size-option" @click="applyPreset(p)">
            {{ p.label }} {{ p.w }}×{{ p.h }}
          </button>
          <div class="sketch-size-menu-title">自定义</div>
          <div class="sketch-size-custom">
            <input v-model="customW" class="sketch-size-input" @keydown.enter="applyCustomSize" /> ×
            <input v-model="customH" class="sketch-size-input" @keydown.enter="applyCustomSize" />
            <button class="sketch-btn sketch-btn-sm" @click="applyCustomSize">✓</button>
          </div>
        </div>
      </div>

      <div class="sketch-toolbar-info">
        <button class="sketch-btn sketch-btn-save" @click="save()" title="保存">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h8l5 5v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M7 3v4h5"/></svg>
          保存
        </button>
        <span v-if="selectedId && selectedEl" style="margin-left:4px">
          <input type="color" :value="selectedEl.color || '#6366f1'" @input="applyColor(($event.target as HTMLInputElement).value)" class="sketch-color-picker" />
          <button v-for="c in colors" :key="c" class="sketch-color-dot" :style="{ background: c, outline: selectedEl.color === c ? '2px solid #6366f1' : 'none' }" @click="applyColor(c)"></button>
        </span>
        <span v-else style="margin-left:8px">{{ localElements.length }} 个图层</span>
      </div>
    </div>

    <div class="sketch-main">
      <!-- Layers panel -->
      <div class="sketch-layers">
        <div class="sketch-layers-title">图层</div>
        <div class="sketch-layers-list">
          <div
            v-for="(el, i) in [...localElements].reverse()"
            :key="el.id"
            class="sketch-layer-item"
            :class="{ active: el.id === selectedId }"
            @click="selectedId = el.id"
            draggable="true"
            @dragstart="(e: DragEvent) => e.dataTransfer?.setData('text/plain', String(i))"
            @dragover.prevent
            @drop="(e: DragEvent) => { const fi = parseInt(e.dataTransfer?.getData('text/plain') || '0'); const ti = localElements.length - 1 - i; const fromIdx = localElements.length - 1 - fi; if (fromIdx !== ti) moveLayer(fromIdx, ti) }"
          >
            <button class="sketch-layer-vis" @click.stop="toggleLayerVisibility(el.id)" :title="hiddenLayers.has(el.id) ? '显示' : '隐藏'">
              <span v-if="hiddenLayers.has(el.id)" style="opacity:0.3">👁</span>
              <span v-else>👁</span>
            </button>
            <span class="sketch-layer-icon">{{ el.type === 'rect' ? '▬' : el.type === 'circle' ? '●' : 'Ｔ' }}</span>
            <input
              v-if="editingLayerId === el.id"
              v-model="editingLayerName"
              class="sketch-layer-rename"
              @keydown.enter="confirmLayerRename"
              @keydown.escape="confirmLayerRename"
              @blur="confirmLayerRename"
              @click.stop
              autofocus
            />
            <span v-else class="sketch-layer-name" @dblclick.stop="startLayerRename(el.id)">{{ el.text || getLayerName(el) }}</span>
            <span v-if="hiddenLayers.has(el.id)" class="sketch-layer-hidden">隐藏</span>
          </div>
          <div v-if="localElements.length === 0" class="sketch-layers-empty">暂无图层</div>
        </div>
      </div>

      <!-- Canvas -->
      <div class="sketch-canvas-wrap" @wheel.prevent="(e: WheelEvent) => { const factor = e.deltaY < 0 ? 1.05 : 0.95; setZoom(zoom.value * factor) }">
        <svg
          ref="svgRef"
          class="sketch-svg"
          :width="canvasW * zoom" :height="canvasH * zoom"
          :viewBox="`0 0 ${canvasW} ${canvasH}`"
          @mousedown="onPointerDown"
          @mousemove="onPointerMove"
          @mouseup="onPointerUp"
          @mouseleave="onPointerUp"
          @dblclick="onDblClick"
        >
          <!-- Grid -->
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.5"/>
            </pattern>
          </defs>
          <rect :width="canvasW" :height="canvasH" fill="url(#grid)" />
          <rect :width="canvasW" :height="canvasH" fill="none" stroke="#cbd5e1" stroke-width="1" />

          <!-- Elements -->
          <g v-for="el in localElements" :key="el.id">
            <g v-if="!hiddenLayers.has(el.id)">
              <rect v-if="el.type === 'rect'"
                :x="el.x" :y="el.y" :width="el.w || 0" :height="el.h || 0"
                :fill="(el.color || '#6366f1') + '18'" :stroke="el.id === selectedId ? '#6366f1' : (el.color || '#6366f1')"
                :stroke-width="el.id === selectedId ? 2.5 : 1.5" :rx="el.rx ?? 4" style="cursor:pointer" />
              <circle v-if="el.type === 'circle'"
                :cx="el.x" :cy="el.y" :r="el.r || 0"
                :fill="(el.color || '#6366f1') + '18'" :stroke="el.id === selectedId ? '#6366f1' : (el.color || '#6366f1')"
                :stroke-width="el.id === selectedId ? 2.5 : 1.5" style="cursor:pointer" />
              <text v-if="el.type === 'text'"
                :x="el.x" :y="el.y" :fill="el.color || '#1e293b'" :font-size="el.fontSize || 16"
                font-family="system-ui" style="cursor:pointer;user-select:none;dominant-baseline:hanging;font-weight:500">{{ el.text || '' }}</text>

              <!-- Selection indicator + resize handles -->
              <rect v-if="el.id === selectedId && el.type !== 'text'"
                :x="el.type === 'circle' ? (el.x - (el.r || 0) - 4) : (el.x - 4)"
                :y="el.type === 'circle' ? (el.y - (el.r || 0) - 4) : (el.y - 4)"
                :width="el.type === 'circle' ? (el.r || 0) * 2 + 8 : (el.w || 0) + 8"
                :height="el.type === 'circle' ? (el.r || 0) * 2 + 8 : (el.h || 0) + 8"
                fill="none" stroke="#6366f1" stroke-width="1" stroke-dasharray="4 2" rx="2" pointer-events="none" />
              <!-- Corner handles -->
              <template v-if="el.id === selectedId && el.type !== 'text'">
                <rect v-for="pos in ['nw','ne','se','sw']" :key="pos"
                  :x="getHandleRect(el, pos).x" :y="getHandleRect(el, pos).y"
                  :width="HANDLE" :height="HANDLE" fill="#ffffff" stroke="#6366f1" stroke-width="1.5" rx="1"
                  style="cursor:nwse-resize" />
              </template>
            </g>
          </g>
        </svg>

        <!-- Text editing overlay -->
        <div v-if="editingTextId" class="sketch-text-overlay">
          <input v-model="editingText" class="sketch-text-input"
            @keydown.enter="confirmText" @keydown.escape="confirmText"
            @blur="confirmText" ref="textInputRef" autofocus />
        </div>
      </div>

      <!-- Properties panel -->
      <div v-if="selectedEl" class="sketch-props">
        <div class="sketch-props-title">属性</div>
        <div class="sketch-props-section">
          <label class="sketch-prop-label">X</label>
          <input type="range" class="sketch-prop-slider" min="0" :max="canvasW" :value="Math.round(selectedEl.x)" @input="(e: any) => updateElement(selectedEl.id, { x: parseInt(e.target.value) })" />
          <span class="sketch-prop-val">{{ Math.round(selectedEl.x) }}</span>
        </div>
        <div class="sketch-props-section">
          <label class="sketch-prop-label">Y</label>
          <input type="range" class="sketch-prop-slider" min="0" :max="canvasH" :value="Math.round(selectedEl.y)" @input="(e: any) => updateElement(selectedEl.id, { y: parseInt(e.target.value) })" />
          <span class="sketch-prop-val">{{ Math.round(selectedEl.y) }}</span>
        </div>
        <div v-if="selectedEl.w !== undefined" class="sketch-props-section">
          <label class="sketch-prop-label">宽</label>
          <input type="range" class="sketch-prop-slider" min="10" :max="canvasW" :value="Math.round(selectedEl.w)" @input="(e: any) => updateElement(selectedEl.id, { w: parseInt(e.target.value) })" />
          <span class="sketch-prop-val">{{ Math.round(selectedEl.w) }}</span>
        </div>
        <div v-if="selectedEl.h !== undefined" class="sketch-props-section">
          <label class="sketch-prop-label">高</label>
          <input type="range" class="sketch-prop-slider" min="10" :max="canvasH" :value="Math.round(selectedEl.h)" @input="(e: any) => updateElement(selectedEl.id, { h: parseInt(e.target.value) })" />
          <span class="sketch-prop-val">{{ Math.round(selectedEl.h) }}</span>
        </div>
        <div v-if="selectedEl.type === 'rect'" class="sketch-props-section">
          <label class="sketch-prop-label">圆角</label>
          <input class="sketch-prop-input" type="range" min="0" max="50" :value="selectedEl.rx ?? 4" @input="(e: any) => updateElement(selectedEl.id, { rx: parseInt(e.target.value) })" />
          <span class="sketch-prop-val">{{ selectedEl.rx ?? 4 }}</span>
        </div>
        <div v-if="selectedEl.r !== undefined" class="sketch-props-section">
          <label class="sketch-prop-label">半径</label>
          <input class="sketch-prop-input" :value="Math.round(selectedEl.r)" @change="(e: any) => updateElement(selectedEl.id, { r: parseFloat(e.target.value) || 0 })" />
        </div>
        <div class="sketch-props-section">
          <label class="sketch-prop-label">文字</label>
          <input class="sketch-prop-input sketch-prop-input-wide" :value="selectedEl.text || ''" @change="(e: any) => updateElement(selectedEl.id, { text: e.target.value })" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sketch-editor { flex: 1; display: flex; flex-direction: column; background: #ffffff; outline: none; height: 100%; }
/* Toolbar */
.sketch-toolbar { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0; flex-wrap: wrap; }
.sketch-toolbar-group { display: flex; align-items: center; gap: 2px; }
.sketch-divider { width: 1px; height: 22px; background: #e2e8f0; margin: 0 4px; flex-shrink: 0; }
.sketch-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; border: 1px solid transparent; border-radius: 5px; background: transparent; cursor: pointer; color: #475569; font-size: 13px; transition: all 0.1s; padding: 0 5px; }
.sketch-btn:hover { background: #e2e8f0; }
.sketch-btn.active { background: #eef2ff; border-color: #6366f1; color: #6366f1; }
.sketch-btn:disabled { opacity: 0.3; cursor: default; }
.sketch-btn-sm { min-width: 26px; height: 26px; font-size: 12px; }
.sketch-zoom-group { gap: 0; }
.sketch-zoom-slider { width: 80px; height: 4px; cursor: pointer; accent-color: #6366f1; margin: 0 2px; }
.sketch-zoom-label { font-size: 11px; font-weight: 600; color: #64748b; min-width: 36px; text-align: center; }
.sketch-size-label { font-size: 11px; font-weight: 600; color: #64748b; }
.sketch-size-group { position: relative; }
.sketch-size-menu { position: absolute; top: 100%; left: 0; z-index: 100; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); padding: 6px; min-width: 160px; }
.sketch-size-menu-title { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 6px 2px; }
.sketch-size-option { display: block; width: 100%; text-align: left; padding: 5px 8px; border: none; background: transparent; border-radius: 4px; font-size: 12px; cursor: pointer; color: #1e293b; }
.sketch-size-option:hover { background: #f1f5f9; }
.sketch-size-custom { display: flex; align-items: center; gap: 4px; padding: 4px 6px; font-size: 12px; color: #64748b; }
.sketch-size-input { width: 50px; padding: 3px 4px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; text-align: center; outline: none; }
.sketch-size-input:focus { border-color: #6366f1; }

.sketch-toolbar-info { margin-left: auto; display: flex; align-items: center; gap: 3px; font-size: 11px; color: #94a3b8; }
.sketch-color-picker { width: 22px; height: 22px; border: none; border-radius: 4px; cursor: pointer; padding: 0; vertical-align: middle; }
.sketch-color-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #e2e8f0; cursor: pointer; display: inline-block; transition: transform 0.1s; padding: 0; vertical-align: middle; }
.sketch-color-dot:hover { transform: scale(1.2); }

/* Main area */
.sketch-main { flex: 1; display: flex; overflow: hidden; }

/* Layers panel */
.sketch-layers { width: 180px; border-right: 1px solid #e2e8f0; background: #fafafa; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.sketch-layers-title { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 10px 6px; flex-shrink: 0; }
.sketch-layers-list { flex: 1; overflow-y: auto; padding: 0 4px 8px; }
.sketch-layer-item { display: flex; align-items: center; gap: 4px; padding: 5px 6px; border-radius: 5px; cursor: pointer; font-size: 11px; transition: background 0.08s; }
.sketch-layer-item:hover { background: #f1f5f9; }
.sketch-layer-item.active { background: #eef2ff; }
.sketch-layer-vis { background: none; border: none; cursor: pointer; padding: 0; font-size: 11px; line-height: 1; flex-shrink: 0; }
.sketch-layer-icon { font-size: 10px; color: #64748b; width: 14px; text-align: center; flex-shrink: 0; }
.sketch-layer-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #334155; font-weight: 500; }
.sketch-layer-hidden { font-size: 9px; color: #94a3b8; background: #f1f5f9; padding: 0 4px; border-radius: 3px; }
.sketch-layer-rename { flex: 1; font-size: 11px; border: 1px solid #6366f1; border-radius: 3px; outline: none; padding: 1px 4px; font-family: inherit; background: #fff; }
.sketch-layers-empty { font-size: 11px; color: #cbd5e1; text-align: center; padding: 20px 0; }

/* Canvas */
.sketch-canvas-wrap { flex: 1; display: flex; align-items: center; justify-content: center; background: #f1f5f9; overflow: auto; position: relative; }
.sketch-svg { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); cursor: crosshair; flex-shrink: 0; }

/* Text editing */
.sketch-text-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; }
.sketch-text-input { font-size: 16px; border: 2px solid #6366f1; border-radius: 4px; outline: none; padding: 2px 6px; font-family: inherit; min-width: 80px; background: #ffffff; box-shadow: 0 2px 12px rgba(99,102,241,0.25); }

/* Properties panel */
.sketch-props { width: 180px; border-left: 1px solid #e2e8f0; background: #fafafa; padding: 10px; overflow-y: auto; flex-shrink: 0; }
.sketch-props-title { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.sketch-props-section { display: flex; align-items: center; gap: 3px; margin-bottom: 6px; flex-wrap: wrap; }
.sketch-prop-label { font-size: 10px; font-weight: 600; color: #64748b; min-width: 24px; }
.sketch-prop-input { width: 52px; padding: 3px 4px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; text-align: center; outline: none; font-family: inherit; }
.sketch-prop-input-wide { width: 100%; text-align: left; }
.sketch-prop-input:focus { border-color: #6366f1; }
.sketch-prop-slider { flex: 1; height: 4px; cursor: pointer; accent-color: #6366f1; min-width: 0; }
.sketch-prop-val { font-size: 10px; font-weight: 600; color: #64748b; min-width: 28px; text-align: right; }
</style>
