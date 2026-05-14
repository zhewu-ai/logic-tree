<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TreeNode } from '../types'

const props = defineProps<{ trees: TreeNode[] }>()
const emit = defineEmits<{ import: [json: string] }>()

const rawJson = computed(() => JSON.stringify(props.trees, null, 2))
const showImport = ref(false)
const importText = ref('')

function doImport() {
  emit('import', importText.value)
  importText.value = ''
  showImport.value = false
}
</script>

<template>
  <aside class="panel">
    <div class="panel-header">
      <h3 class="panel-title">JSON 结构</h3>
      <span class="panel-badge">{{ props.trees.length }} 棵树</span>
    </div>

    <pre class="panel-json"><code>{{ rawJson }}</code></pre>

    <div class="panel-import-actions">
      <button class="btn" @click="showImport = !showImport">
        {{ showImport ? '✕ 关闭' : '📂 粘贴导入' }}
      </button>
    </div>

    <div v-if="showImport" class="panel-import">
      <textarea
        v-model="importText"
        class="panel-import-input"
        placeholder="粘贴 JSON 结构..."
        rows="4"
      ></textarea>
      <button class="btn btn-primary" style="width:100%" @click="doImport">导入</button>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  width: 300px;
  background: #ffffff;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  user-select: none;
}
.panel-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.panel-badge {
  font-size: 10px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 10px;
}
.panel-json {
  flex: 1;
  overflow-y: auto;
  margin: 4px 12px 8px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 10px;
  line-height: 1.7;
  color: #475569;
  white-space: pre;
}
.panel-import-actions {
  padding: 0 12px 8px;
}
.btn {
  width: 100%;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
  text-align: center;
}
.btn:hover {
  background: #e2e8f0;
}
.btn-primary {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}
.btn-primary:hover {
  background: #4f46e5;
}
.panel-import {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-import-input {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #1e293b;
  padding: 8px;
  font-family: monospace;
  font-size: 11px;
  resize: vertical;
  outline: none;
}
.panel-import-input:focus {
  border-color: #6366f1;
}
</style>
