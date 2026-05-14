import type { LogicNodeData } from '../types'
import type { Node, Edge } from '@vue-flow/core'

const NODE_W = 260
const NODE_H = 80
const H_GAP = 100
const V_GAP = 40

interface LayoutNode {
  id: string
  data: LogicNodeData
  x: number
  y: number
}

interface SubtreeInfo {
  id: string
  data: LogicNodeData
  children: SubtreeInfo[]
  /** Total width of this subtree (parent + gap + max child width) */
  width: number
  /** Total height of this subtree (all children stacked + gaps) */
  height: number
  /** Y offset of this node relative to subtree top */
  nodeY: number
  /** Y offsets of each child relative to subtree top */
  childY: number[]
}

/**
 * Build a tree info structure bottom-up.
 * All positions are relative to the subtree origin (top-left).
 */
function buildTree(id: string, nodeMap: Map<string, LogicNodeData>): SubtreeInfo {
  const data = nodeMap.get(id)!
  let childIds = (data.children || []).filter((cid) => nodeMap.has(cid))

  // Sort condition node children by branch (a, b, c...)
  if (data.type === 'condition') {
    childIds = childIds.sort((a, b) => {
      const ba = nodeMap.get(a)!.branch || ''
      const bb = nodeMap.get(b)!.branch || ''
      return ba.localeCompare(bb)
    })
  }

  const children = childIds.map((cid) => buildTree(cid, nodeMap))

  if (children.length === 0) {
    return {
      id,
      data,
      children: [],
      width: NODE_W,
      height: NODE_H,
      nodeY: 0,
      childY: [],
    }
  }

  const totalChildH = children.reduce((s, c) => s + c.height, 0)
  const gaps = (children.length - 1) * V_GAP
  const totalH = Math.max(NODE_H, totalChildH + gaps)

  // Stack children vertically, centered within subtree
  const childY: number[] = []
  let startY = (totalH - totalChildH - gaps) / 2
  for (const ch of children) {
    childY.push(startY)
    startY += ch.height + V_GAP
  }

  // Parent centered vertically among children
  const nodeY = (totalH - NODE_H) / 2
  const childMaxW = Math.max(...children.map((c) => c.width))

  return {
    id,
    data,
    children,
    width: NODE_W + H_GAP + childMaxW,
    height: totalH,
    nodeY,
    childY,
  }
}

/**
 * Second pass: assign absolute positions top-down.
 */
function assignPositions(
  info: SubtreeInfo,
  absX: number,
  absY: number,
  acc: Map<string, LayoutNode>,
  dx = 0,
  dy = 0,
) {
  // Tree position for this node
  const treeX = absX
  const treeY = absY + info.nodeY

  // If node was dragged (savedX/Y), use that; otherwise tree + inherited offset
  const finalX = info.data.savedX !== undefined ? info.data.savedX : treeX + dx
  const finalY = info.data.savedY !== undefined ? info.data.savedY : treeY + dy

  acc.set(info.id, {
    id: info.id,
    data: info.data,
    x: finalX,
    y: finalY,
  })

  // Compute drag delta — children inherit this offset from the nearest dragged ancestor
  const childDx = info.data.savedX !== undefined ? finalX - treeX : dx
  const childDy = info.data.savedY !== undefined ? finalY - treeY : dy

  const childX = absX + NODE_W + H_GAP
  for (let i = 0; i < info.children.length; i++) {
    assignPositions(
      info.children[i],
      childX,
      absY + info.childY[i],
      acc,
      childDx,
      childDy,
    )
  }
}

/**
 * Calculate horizontal tree layout (left → right).
 * Uses bottom-up tree sizing + top-down position assignment
 * for a clean, balanced layout without overlapping.
 */
export function calcLayout(
  nodeMap: Map<string, LogicNodeData>,
): { nodes: Node[]; edges: Edge[] } {
  const roots: string[] = []
  for (const [id, d] of nodeMap) {
    if (!d.parentId) roots.push(id)
  }

  // Build trees
  const trees = roots.map((id) => buildTree(id, nodeMap))

  // Position trees stacked vertically
  const layoutNodes = new Map<string, LayoutNode>()
  let currentY = 40
  const startX = 40
  for (const tree of trees) {
    assignPositions(tree, startX, currentY, layoutNodes)
    currentY += tree.height + V_GAP
  }

  // Build Vue Flow nodes (use savedX/savedY if dragged)
  const nodes: Node[] = []
  for (const [id, ln] of layoutNodes) {
    const data = nodeMap.get(id)!
    nodes.push({
      id,
      type: 'window',
      position: {
        x: data.savedX !== undefined ? data.savedX : ln.x,
        y: data.savedY !== undefined ? data.savedY : ln.y,
      },
      data,
    })
  }

  // Build edges
  const edges: Edge[] = []
  for (const [id, data] of nodeMap) {
    if (data.parentId && nodeMap.has(data.parentId)) {
      const parentData = nodeMap.get(data.parentId)
      const sourceHandle = parentData?.type === 'condition' && data.branch
        ? `branch-${data.branch}`
        : undefined
      edges.push({
        id: `e-${data.parentId}-${id}`,
        source: data.parentId,
        target: id,
        sourceHandle,
        type: 'smoothstep',
        animated: false,
        selectable: true,
        style: { stroke: '#cbd5e1', strokeWidth: 2 },
      })
    }
    // Multi-parent edges
    if (data.extraParents) {
      for (const epId of data.extraParents) {
        if (nodeMap.has(epId)) {
          edges.push({
            id: `e-${epId}-${id}`,
            source: epId,
            target: id,
            sourceHandle: undefined,
            type: 'smoothstep',
            animated: false,
            selectable: true,
            style: { stroke: '#cbd5e1', strokeWidth: 2 },
          })
        }
      }
    }
  }

  return { nodes, edges }
}
