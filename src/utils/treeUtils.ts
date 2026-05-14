import type { LogicNodeData, TreeNode, NodeType } from '../types'

let idCounter = 0
export function genId(): string {
  return `node-${++idCounter}-${Date.now().toString(36)}`
}

/** Build a tree from flat node map (adjacency via parentId) */
export function buildTree(
  nodeMap: Map<string, LogicNodeData>,
  rootId: string | null,
): TreeNode | null {
  const data = rootId ? nodeMap.get(rootId) : null
  if (!data) return null
  return {
    id: data.id,
    type: data.type,
    label: data.label,
    description: data.description,
    properties: { ...data.properties },
    branch: data.branch,
    outputBranches: data.outputBranches,
    extraParents: data.extraParents?.length ? [...data.extraParents] : undefined,
    sketchElements: data.sketchElements ? data.sketchElements.map(s => ({...s})) : undefined,
    sketchW: data.sketchW,
    sketchH: data.sketchH,
    children: data.children
      .map((cid) => buildTree(nodeMap, cid))
      .filter((n): n is TreeNode => n !== null),
  }
}

/** Convert flat node map to a list of root trees */
export function toTrees(nodeMap: Map<string, LogicNodeData>): TreeNode[] {
  const roots: TreeNode[] = []
  for (const [id, data] of nodeMap) {
    if (!data.parentId) {
      const t = buildTree(nodeMap, id)
      if (t) roots.push(t)
    }
  }
  return roots
}

/** Flatten a tree back to node map */
export function treeToMap(tree: TreeNode): Map<string, LogicNodeData> {
  const map = new Map<string, LogicNodeData>()
  function walk(node: TreeNode, parentId: string | null) {
    const data: LogicNodeData = {
      id: node.id,
      type: node.type,
      label: node.label,
      description: node.description,
      properties: { ...node.properties },
      parentId,
      children: node.children.map((c) => c.id),
      branch: node.branch,
      outputBranches: node.outputBranches,
      extraParents: node.extraParents?.length ? [...node.extraParents] : undefined,
      sketchElements: node.sketchElements ? node.sketchElements.map(s => ({...s})) : undefined,
      sketchW: node.sketchW,
      sketchH: node.sketchH,
    }
    map.set(data.id, data)
    node.children.forEach((c) => walk(c, node.id))
  }
  walk(tree, null)
  return map
}

/** Deep clone a TreeNode tree with all-new IDs */
export function cloneTree(tree: TreeNode): TreeNode | null {
  if (!tree) return null
  const newId = genId()
  return {
    id: newId,
    type: tree.type,
    label: tree.label,
    description: tree.description,
    properties: { ...tree.properties },
    branch: tree.branch,
    outputBranches: tree.outputBranches,
    extraParents: tree.extraParents ? [...tree.extraParents] : undefined,
    sketchElements: tree.sketchElements ? tree.sketchElements.map(s => ({...s})) : undefined,
    sketchW: tree.sketchW,
    sketchH: tree.sketchH,
    children: (tree.children || []).map(c => cloneTree(c, newId)).filter((n): n is TreeNode => n !== null),
  }
}

export function createNode(
  type: NodeType,
  label: string,
  parentId: string | null = null,
): LogicNodeData {
  const id = genId()
  return {
    id,
    type,
    label: label || type,
    description: '',
    properties: {},
    parentId,
    children: [],
  }
}
