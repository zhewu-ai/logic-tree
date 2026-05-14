export type NodeType = 'page' | 'module' | 'component' | 'condition' | 'action' | 'note' | 'sketch'

export interface SketchElement {
  id: string
  type: 'rect' | 'circle' | 'text'
  x: number
  y: number
  w?: number   // rect width
  h?: number   // rect height
  r?: number   // circle radius
  text?: string
  color?: string
  fontSize?: number
  rx?: number  // rect corner radius
}

export interface LogicNodeData {
  id: string
  type: NodeType
  label: string
  description: string
  properties: Record<string, string>
  parentId: string | null
  children: string[]
  /** Branch assignment for condition node: 'a', 'b', 'c'... */
  branch?: string
  /** Additional parent connections for multi-parent (DAG) support */
  extraParents?: string[]
  /** Number of output branches for condition node (default 2) */
  outputBranches?: number
  /** Drawing elements for sketch nodes */
  sketchElements?: SketchElement[]
  /** Canvas dimensions for sketch editor */
  sketchW?: number
  sketchH?: number
  /** @vue-flow/core node data carries this */
  isDetailExpanded?: boolean
  followUp?: string
  isExpanding?: boolean
  error?: string
  /** Position saved after user drag */
  savedX?: number
  savedY?: number
}

export interface TreeNode {
  id: string
  type: NodeType
  label: string
  description: string
  properties: Record<string, string>
  children: TreeNode[]
  branch?: string
  /** Number of output branches for condition node (default 2) */
  outputBranches?: number
  /** Additional parent connections (multi-parent / DAG) */
  extraParents?: string[]
  /** Drawing elements for sketch nodes */
  sketchElements?: SketchElement[]
  sketchW?: number
  sketchH?: number
}

export interface TabInfo {
  id: string
  name: string
  selectedNodeId: string | null
}

export interface NodeTypeDef {
  type: NodeType
  label: string
  icon: string
  color: string
}

/** Simple flat SVG icons (20×20 viewBox, fill/stroke inherit currentColor) */
const ICONS = {
  page: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M12 2v4h4"/></svg>`,
  module: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 10h14M10 3v14"/></svg>`,
  component: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="12" height="10" rx="1.5"/><path d="M8 6V5a2 2 0 114 0v1"/></svg>`,
  condition: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2l8 8-8 8-8-8z"/></svg>`,
  action: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l12 7-12 7V3z"/></svg>`,
  note: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h14v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4z"/><path d="M6 8h8M6 11h8M6 14h5"/></svg>`,
  sketch: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="6" height="5" rx="1"/><rect x="11" y="4" width="6" height="5" rx="1"/><ellipse cx="6" cy="16" rx="3" ry="2"/><circle cx="14" cy="15" r="2.5"/><path d="M1 18l3-2 2 2 4-3 3 2"/></svg>`,
}

export const NODE_TYPES: NodeTypeDef[] = [
  {
    type: 'page',
    label: '主题',
    icon: ICONS.page,
    color: '#6366f1',
  },
  {
    type: 'module',
    label: '模块',
    icon: ICONS.module,
    color: '#8b5cf6',
  },
  {
    type: 'component',
    label: '组件',
    icon: ICONS.component,
    color: '#06b6d4',
  },
  {
    type: 'condition',
    label: 'If',
    icon: ICONS.condition,
    color: '#f59e0b',
  },
  {
    type: 'action',
    label: '动作',
    icon: ICONS.action,
    color: '#ef4444',
  },
  {
    type: 'note',
    label: '默认',
    icon: ICONS.note,
    color: '#10b981',
  },
  {
    type: 'sketch',
    label: '绘制',
    icon: ICONS.sketch,
    color: '#ec4899',
  },
]

export const NODE_TYPE_MAP = new Map(NODE_TYPES.map((n) => [n.type, n]))
