# AI节点交互看板 — LogicTree

结构化逻辑树可视化工具。拖拽节点搭建逻辑关系，支持条件分支、多对一连接、绘制草图。AI 可直接读写 JSON 结构实现双向沟通。

## 功能

- 树形逻辑编辑器（拖拽连线、条件分支 A/B/C、多对一连接）
- 多画布标签页
- 绘制草图组件（矩形/圆形/文字，AI 可精确读取坐标和布局）
- JSON 导入/导出
- 本地自动保存
- AI 实时同步（通过 `sync-output.json` + Vite HMR）

## 启动

```bash
npm install
npm run dev
# 浏览器打开 http://localhost:5173/
```

## 节点类型

| 类型 | 说明 |
|------|------|
| 主题 | 顶层入口，一个独立概念 |
| 模块 | 容器，一组相关内容的归类 |
| 组件 | 具体元素，最小单位 |
| If | 条件分支，输出 A/B/C |
| 动作 | 行为或操作 |
| 信息 | 通用描述节点 |
| 绘制 | UI 草图，点进去画矩形/圆形/文字 |

## 与 AI 配合使用

**用户 → AI**：在画布绘制逻辑树 → 导出 JSON → 发送给 AI 理解
**AI → 用户**：写入 `sync-output.json` → 浏览器自动刷新显示树

同步脚本：
```bash
node sync.js read      # 读取当前树
node sync.js write '...'  # 写入新树
```

## 技术栈

Vue 3 + TypeScript + Vite + @vue-flow/core
