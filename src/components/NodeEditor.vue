<script setup lang="ts">
import { computed } from 'vue'
import type { LogicNodeData } from '../types'
import { NODE_TYPE_MAP, NODE_TYPES } from '../types'

const props = defineProps<{
  node: LogicNodeData | null
}>()

const emit = defineEmits<{
  update: [id: string, key: string, value: string]
  openSketch: []
}>()

const def = computed(() =>
  props.node ? NODE_TYPE_MAP.get(props.node.type) : null,
)

const propKeys = computed(() => {
  if (!props.node) return []
  return Object.keys(props.node.properties || {})
})

function set(key: string, value: string) {
  if (props.node) {
    emit('update', props.node.id, key, value)
  }
}

function addProp() {
  if (!props.node) return
  const key = `prop_${propKeys.value.length + 1}`
  props.node.properties[key] = ''
}

function removeProp(k: string) {
  if (!props.node) return
  delete props.node.properties[k]
}
</script>

<template>
  <div v-if="node" class="editor">
    <div class="editor-section">
      <div class="editor-label">名称</div>
      <input
        :value="node.label"
        @input="set('label', ($event.target as HTMLInputElement).value)"
        class="editor-input"
      />
    </div>

    <div class="editor-section">
      <div class="editor-label">描述</div>
      <textarea
        :value="node.description"
        @input="set('description', ($event.target as HTMLTextAreaElement).value)"
        class="editor-input editor-textarea"
        rows="2"
      ></textarea>
    </div>

    <div v-if="node.type === 'condition'" class="editor-section">
      <div class="editor-label">输出分支</div>
      <div class="branch-selector">
        <button v-for="n in 6" :key="n" class="branch-btn" :class="{ active: (node.outputBranches || 2) === n }" @click="node.outputBranches = n">{{ n }}</button>
      </div>
    </div>

    <div class="editor-section">
      <div class="editor-label-row">
        <span class="editor-label">属性</span>
        <button class="editor-add-prop" @click="addProp">+</button>
      </div>
      <div v-for="(val, key) in node.properties" :key="key" class="prop-row">
        <span class="prop-key">{{ key }}</span>
        <input
          :value="val"
          @input="set('properties.' + key, ($event.target as HTMLInputElement).value)"
          class="editor-input prop-val"
        />
        <button class="prop-del" @click="removeProp(key)">×</button>
      </div>
      <div v-if="!propKeys.length" class="editor-empty-hint">暂无属性</div>
    </div>

    <div class="editor-section">
      <div class="editor-label">节点类型</div>
      <select
        :value="node.type"
        @change="set('type', ($event.target as HTMLSelectElement).value)"
        class="editor-select"
        :style="{ color: def?.color }"
      >
        <option v-for="nt in NODE_TYPES" :key="nt.type" :value="nt.type">{{ nt.label }}</option>
      </select>
    </div>

    <div v-if="node.type === 'sketch'" class="editor-section">
      <button class="sketch-open-btn" @click="emit('openSketch')">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="6" height="5" rx="1"/><rect x="11" y="4" width="6" height="5" rx="1"/><ellipse cx="6" cy="16" rx="3" ry="2"/><circle cx="14" cy="15" r="2.5"/></svg>
        打开画板
        <span class="sketch-open-badge">{{ node.sketchElements?.length || 0 }} 个图形</span>
      </button>
    </div>

    <div class="editor-section">
      <div class="editor-label">节点 ID</div>
      <div class="editor-mono">{{ node.id }}</div>
    </div>
  </div>
  <div v-else class="editor-empty">
    <div class="editor-empty-icon">👆</div>
    <div>选择一个节点</div>
    <div class="editor-empty-hint">点击画布上的节点编辑属性</div>
  </div>
</template>

<style scoped>
.editor {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor-empty {
  padding: 40px 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.editor-empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.editor-empty-hint {
  font-size: 11px;
  color: #cbd5e1;
  margin-top: 4px;
}
.editor-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.editor-label {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.editor-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.editor-add-prop {
  background: transparent;
  border: 1px solid #e2e8f0;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
  color: #64748b;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.editor-add-prop:hover {
  background: #f1f5f9;
}
.editor-input {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #1e293b;
  padding: 8px 10px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.12s;
}
.editor-input:focus {
  border-color: #6366f1;
}
.editor-textarea {
  resize: vertical;
  font-family: inherit;
}
.editor-select {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #1e293b;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: border-color 0.12s;
  appearance: auto;
}
.editor-select:focus {
  border-color: #6366f1;
}
.editor-mono {
  font-size: 10px;
  color: #94a3b8;
  font-family: monospace;
  word-break: break-all;
}
.prop-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.prop-key {
  font-size: 10px;
  font-weight: 600;
  color: #475569;
  font-family: monospace;
  min-width: 60px;
}
.prop-val {
  flex: 1;
}
.prop-del {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 16px;
  padding: 0 2px;
}
.prop-del:hover {
  color: #ef4444;
}

/* Branch selector */
.branch-selector {
  display: flex;
  gap: 4px;
}
.branch-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}
.branch-btn:hover {
  border-color: #f59e0b;
  color: #f59e0b;
}
.branch-btn.active {
  background: #f59e0b;
  border-color: #f59e0b;
  color: #fff;
}

/* Sketch open button */
.sketch-open-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 12px;
  background: #fdf2f8;
  border: 1px solid #f9a8d4;
  border-radius: 10px;
  color: #be185d;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.12s;
  font-family: inherit;
}
.sketch-open-btn:hover {
  background: #fce7f3;
  border-color: #ec4899;
}
.sketch-open-badge {
  margin-left: auto;
  font-size: 10px;
  background: #fce7f3;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  color: #db2777;
}
</style>
