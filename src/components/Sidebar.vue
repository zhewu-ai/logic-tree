<script setup lang="ts">
import { NODE_TYPES } from '../types'
import type { NodeType } from '../types'

const nodeTypeDescriptions: Record<string, string> = {
  page: '顶层入口，一个独立的概念或主题',
  module: '容器，一组相关内容的归类',
  component: '具体元素，构成内容的最小单位',
  condition: '逻辑分支，满足条件走 a，否则走 b',
  action: '行为或操作，触发某个动作',
  note: '通用描述节点，默认文本',
  sketch: '绘制草图，用图形表达界面布局或示意图',
}

const emit = defineEmits<{
  addNode: [type: NodeType, label?: string]
}>()

function onDragStart(event: DragEvent, type: NodeType) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('logic-tree-type', type)
    event.dataTransfer.effectAllowed = 'copy'
  }
}

function onClickAdd(type: NodeType, label?: string) {
  emit('addNode', type, label)
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="4" r="2.5"/>
          <circle cx="5" cy="18" r="2.5"/>
          <circle cx="19" cy="18" r="2.5"/>
          <path d="M10 6.5L7 16"/>
          <path d="M14 6.5L17 16"/>
        </svg>
      </span>
      <span class="sidebar-title">AI节点交互看板</span>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-title">组件面板</div>
      <div class="sidebar-hint">点击添加 · 拖拽到位置</div>
    </div>

    <div
      v-for="def in NODE_TYPES"
      :key="def.type"
      class="palette-item"
      :draggable="true"
      @dragstart="onDragStart($event, def.type)"
      @click="onClickAdd(def.type, def.label)"
    >
      <div
        class="palette-icon-wrap"
        :style="{ backgroundColor: def.color + '15' }"
      >
        <span class="svg-icon" v-html="def.icon"></span>
      </div>
      <div class="palette-info">
        <div class="palette-name">{{ def.label }}</div>
        <div class="palette-type">{{ nodeTypeDescriptions[def.type] || def.type }}</div>
      </div>
      <div class="palette-badge">+</div>
    </div>

    <div class="sidebar-divider"></div>

    <div class="sidebar-actions-title">使用说明</div>
    <div class="tips">
      <span class="tip"><kbd>点击</kbd> 添加</span>
      <span class="tip"><kbd>拖拽</kbd> 定位</span>
      <span class="tip"><kbd>连线</kbd> 建关系</span>
      <span class="tip"><kbd>Del</kbd> 删除</span>
    </div>

    <div class="sidebar-divider"></div>

    <div class="sidebar-actions-title">节点类型</div>
    <div class="typelist">
      <div v-for="def in NODE_TYPES" :key="'help-' + def.type" class="typelist-item">
        <span class="typelist-icon" :style="{ color: def.color }" v-html="def.icon"></span>
        <div class="typelist-info">
          <span class="typelist-name">{{ def.label }}</span>
          <span class="typelist-desc">{{ nodeTypeDescriptions[def.type] }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 230px;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 2px;
  overflow-y: auto;
  user-select: none;
  z-index: 10;
}
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.sidebar-logo {
  display: flex;
  align-items: center;
}
.sidebar-title {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}
.sidebar-section {
  margin-bottom: 8px;
}
.sidebar-section-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}
.sidebar-hint {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s;
}
.palette-item:hover {
  background: #f1f5f9;
}
.palette-item:active {
  background: #e2e8f0;
}
.palette-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: inherit;
}
.svg-icon {
  display: flex;
  align-items: center;
  color: inherit;
}
.svg-icon svg {
  display: block;
}
.palette-info {
  flex: 1;
}
.palette-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}
.palette-type {
  font-size: 10px;
  color: #94a3b8;
  font-family: monospace;
}
.palette-badge {
  font-size: 16px;
  color: #94a3b8;
  opacity: 0;
  transition: opacity 0.12s;
}
.palette-item:hover .palette-badge {
  opacity: 1;
}
.sidebar-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 10px 0 8px;
}
.sidebar-actions-title {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 600;
  margin-bottom: 4px;
}
/* Tips section */
.tips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.tip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  padding: 3px 8px;
  border-radius: 6px;
}
.tip kbd {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 9px;
  color: #475569;
}

/* Type list section */
.typelist {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 4px;
}
.typelist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background 0.1s;
}
.typelist-item:hover {
  background: #f8fafc;
}
.typelist-icon {
  width: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.typelist-icon :deep(svg) {
  display: block;
}
.typelist-info {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.typelist-name {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  flex-shrink: 0;
}
.typelist-desc {
  font-size: 10px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
