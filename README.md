# LogicTree

> Visual logic maps for AI collaboration, product planning, and complex workflow design.

LogicTree is a browser-based visual thinking tool that turns scattered product ideas, AI prompts, decision branches, user flows, and rough UI sketches into one editable logic tree. It is built for people who need to explain complex ideas clearly before writing code, creating specs, or asking AI to help.

Live demo:

https://zhewu-ai.github.io/logic-tree/

## What Problem Does LogicTree Solve?

When teams work with AI, product requirements, or complex workflows, the hardest part is often not writing more text. The hard part is keeping the structure visible.

Traditional notes, chat logs, and plain documents quickly become hard to follow:

- Ideas are scattered across long conversations.
- Product logic is mixed with implementation details.
- Decision branches are difficult to compare.
- UI concepts are separated from the reasoning behind them.
- AI assistants receive incomplete context and often misunderstand the real intent.

LogicTree solves this by putting text, hierarchy, branches, page structure, and sketch-level interaction ideas into the same canvas. The result is a shared visual context that both humans and AI can understand.

## Why It Is Useful

LogicTree helps you move from vague ideas to structured execution.

You can use it to:

- Break down a product idea into clear modules.
- Map user journeys, feature logic, and decision flows.
- Prepare better prompts and context for AI coding assistants.
- Explain business rules or interface behavior to collaborators.
- Turn early-stage thinking into a readable planning artifact.
- Keep product logic, UX structure, and implementation notes connected.

Instead of sending AI a long paragraph and hoping it understands the architecture, you can first organize the logic visually, then use that structure as a stronger source of context.

## Key Features

- Visual tree editor for structured thinking.
- Multiple node types for text, feature modules, pages, workflows, and sketches.
- Drag-and-drop canvas interaction.
- Editable node titles, descriptions, and hierarchy.
- Sketch editor for quick interface and interaction ideas.
- Import and export support for project data.
- Local-first browser experience with no backend requirement.
- GitHub Pages deployment for quick online access.

## Typical Use Cases

- AI-assisted product planning.
- Requirement breakdown before coding.
- Startup idea exploration.
- UX flow and page structure mapping.
- Prompt engineering and context preparation.
- Complex decision-tree visualization.
- Personal knowledge organization.

## Tech Stack

LogicTree is built with Vue 3, TypeScript, Vite, Vue Flow, and modern browser APIs.

---

## 中文介绍

LogicTree 是一个面向产品设计、AI 协作和复杂流程梳理的可视化逻辑树工具。它把「文字说明」「业务分支」「页面结构」「交互草图」放到同一张可编辑画布里，让人和 AI 都能读懂同一份结构化表达。

在线体验：

https://zhewu-ai.github.io/logic-tree/

## 我们解决了什么问题

在和 AI 讨论产品、流程、功能设计时，单纯靠聊天很容易出现这些问题：

- 需求越聊越散，前后上下文难以追踪。
- 页面、模块、组件、条件分支混在文字里，AI 和人都容易理解偏差。
- 画图工具能表达结构，但 AI 很难直接读取和修改。
- JSON 能被 AI 理解，但普通用户不适合直接编辑 JSON。
- 多轮沟通后，设计意图、判断条件、后续动作缺少一个稳定的中间载体。

LogicTree 的核心目标就是把这些内容变成一份「人能拖拽编辑、AI 能结构化读取」的中间文档。用户用画布表达想法，AI 读取 JSON 理解结构；AI 也可以反向生成结构，用户再在画布里检查、调整和继续扩展。

## 核心能力

### 1. 可视化逻辑树

通过节点和连线表达页面、模块、组件、动作、说明和条件判断。相比纯文本，它更适合梳理复杂功能关系、用户路径、决策流程和产品结构。

### 2. 条件分支

`If` 节点支持 A/B/C 等分支输出，适合描述：

- 用户选择不同选项后的流程。
- AI Agent 在不同判断结果下的动作。
- 产品功能里的权限、状态、异常和兜底逻辑。

### 3. 多父级连接

有些内容不是严格树形结构，例如一个组件被多个模块复用，或一个动作由多个条件共同触发。LogicTree 支持多对一连接，能表达更接近真实业务的图结构。

### 4. 绘制草图节点

`绘制` 节点内置轻量草图编辑器，可以画矩形、圆形和文字，并记录精确坐标。它适合快速表达页面布局、组件关系和界面草案，同时保留为 AI 可读取的结构化数据。

### 5. JSON 导入导出

画布内容可以导出为 JSON，也可以从 JSON 重新导入。这样它既是可视化工具，也是 AI 协作协议：

- 用户把画布导出给 AI。
- AI 读取结构后给出修改建议。
- AI 生成新的 JSON，用户导入后继续编辑。

### 6. 多画布和本地保存

支持多个画布标签页，适合同时维护多个方案、多个页面或多个业务流程。数据会自动保存到浏览器本地，减少中断风险。

## 适用场景

- 产品经理梳理功能结构、页面层级和用户路径。
- 设计师在正式设计前快速表达交互草图和布局关系。
- 开发者把业务逻辑拆成可讨论、可追踪的节点图。
- AI Agent 设计者描述任务流、判断分支和工具调用路径。
- 团队把需求文档从纯文字升级为可视化结构。

## 节点类型

| 节点 | 用途 |
| --- | --- |
| 主题 | 顶层入口，表示一个独立产品、页面或概念 |
| 模块 | 一组相关能力或内容的归类 |
| 组件 | 页面或系统中的具体组成部分 |
| If | 条件判断节点，支持多分支输出 |
| 动作 | 用户行为、系统行为或 AI 执行动作 |
| 默认 | 通用说明、备注或补充信息 |
| 绘制 | 内置草图画布，用于表达界面和布局 |

## 和 AI 协作的方式

LogicTree 不是只给人看的图，它的每个节点、连线、分支和草图元素都有明确的数据结构。这样 AI 不需要猜测截图含义，可以直接读取 JSON：

```json
{
  "type": "condition",
  "label": "用户是否登录",
  "children": [
    { "branch": "a", "label": "进入工作台" },
    { "branch": "b", "label": "跳转登录页" }
  ]
}
```

这种方式降低了沟通成本：人负责判断和调整，AI 负责理解、扩展、重组和生成建议。

## 本地开发

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:5173/
```

构建生产版本：

```bash
npm run build
```

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Flow
- GitHub Actions + GitHub Pages

## 项目状态

当前版本已经支持基础逻辑树编辑、多画布、JSON 导入导出、草图节点和 GitHub Pages 在线部署。后续可以继续扩展协作、模板库、AI 自动生成节点、版本历史和更完整的布局能力。
