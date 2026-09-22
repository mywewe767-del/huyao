# Bamboo Weave Studio V2

可编辑的参数化竹编设计 Canvas。纹样由方向、间距、条带和 Crossing 结构实时生成，不使用位图作为最终纹样。

## 运行

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。推荐桌面浏览器，最小视口宽度 1080px。

## V2 已实现

- 任意数量、任意多边形区域，不再存在 `regionLeft / regionRight / divider` 固定模型
- Rectangle、Polygon、Brush、Select、Direct Select、Eraser、Transition、Pan 工具
- 滚轮缩放、Space 拖动画布、Fit/Reset、毫米标尺、网格与吸附
- 区域移动、缩放、旋转、节点编辑、复制、删除、显示、锁定和图层排序
- 28 个数据驱动的多方向参数化纹样及 Pattern Topology
- 背景基础纹样与重叠区域优先级
- 自动区域邻接图，不依赖区域数组位置
- 可编辑 Transition Band：宽度、平滑度、复杂度和三个控制点
- 密度、宽度与方向连续插值，以及显式 Merge / Split 节点
- 多区域 2D SVG 与基础 3D 实体条带预览
- 50 步 Undo/Redo、LocalStorage 自动保存、V2 JSON 读取/保存与 PNG 导出

## 主要操作

1. 选择左侧纹样。
2. 使用 `R` 矩形、`P` 多边形或 `B` 画笔工具创建区域。
3. 使用 `V` 选择并移动/缩放/旋转；使用 `A` 编辑区域节点。
4. 在“图层”中调整区域顺序、显示、锁定、复制或删除。
5. 创建相邻区域后，在画板空白处取消选择，点击右侧“生成全部结构过渡”；也可用 `L` 单独点击邻接边。
6. 选择过渡区后调整宽度、平滑度和复杂度，并拖动画布上的三个控制点。
7. 切换 `3D Realistic` 检查实体条带和过渡曲线。

## 架构

- `src/types`：V2 Document、Region、Pattern Instance、Adjacency、Transition、Merge/Split 模型
- `src/patterns`：28 个纹样定义及拓扑特征
- `src/engine`：几何、纹样生成、邻接图和结构过渡算法
- `src/components`：工具栏、图层、SVG Canvas、属性面板和 Three.js Preview
- `src/store`：Zustand 状态、历史与项目持久化

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
```

当前图片识别/Manual Trace、复杂 Bridge Pattern 搜索、多区域 Junction 和 Web Worker 属于下一阶段 P1/P2，不在本次 P0 实现中。
