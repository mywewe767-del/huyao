# Bamboo Weave Studio V4

可编辑的参数化竹编设计 Canvas。纹样由方向、间距、条带和 Crossing 结构实时生成，不使用位图作为最终纹样。

> 第一次使用：请查看 [V4 中文使用说明书](docs/V4使用说明书.md)。

## 运行

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。推荐桌面浏览器，最小视口宽度 1080px。

## V4 已实现

- 任意数量、任意多边形区域，不再存在 `regionLeft / regionRight / divider` 固定模型
- Rectangle、Polygon、Brush、Select、Direct Select、Eraser、Transition、Crossing Edit、Pan 工具
- 滚轮缩放、Space 拖动画布、Fit/Reset、毫米标尺、网格与吸附
- 区域移动、缩放、旋转、节点编辑、复制、删除、显示、锁定和图层排序
- 28 个结构化 Pattern Definition，以及独立的 Pattern Variant 描述
- Direction Layer 系统：每方向独立角度、密度、间距、宽度、精确条数、颜色与显隐
- Pattern Scale 与 Weave Density 使用不同计算路径
- Crossing Rule：一上一下、方向恒定在上、两上两下、三上一下、自定义序列与单交点覆盖
- 背景基础纹样与重叠区域优先级
- 自动区域邻接图，不依赖区域数组位置
- 可编辑 Transition Band：删除、重新生成、替换策略、模式、宽度、阶段、平滑度、复杂度和控制点
- 10 种过渡策略：Spacing、Count、Width、Rotation、Frequency、Skip、Merge/Split、Fan、Morph、Bridge
- 图片结构提取：本机 Sobel 边缘/方向检测、人工校正方向层，并保存为可编辑用户纹样
- 多区域 2D SVG 与基础 3D 实体条带预览
- 50 步 Undo/Redo、LocalStorage 自动保存、V3/V4 JSON 读取、V4 JSON 保存与 PNG 导出
- Crossing 独立顶层命中与单交点 Over / Under 交换，2D / 3D 同步
- 真实竹条几何切割：全部、区域、方向层、同方向和已选竹条范围，支持保留/删除切割线两侧
- Direction Layer 整体 X/Y 偏移、锁定和 Z 高度；单根竹条拖动、节点路径编辑、重置与手动新增
- Generated / Manual 双状态保存，手动修改不会被重新生成覆盖
- 3D 方向层高度和爆炸视图

## 主要操作

1. 选择左侧纹样。
2. 使用 `R` 矩形、`P` 多边形或 `B` 画笔工具创建区域。
3. 使用 `V` 选择并移动/缩放/旋转；使用 `A` 编辑区域节点。
4. 在“图层”中调整区域顺序、显示、锁定、复制或删除。
5. 创建相邻区域后，在画板空白处取消选择，点击右侧“生成全部结构过渡”；也可用 `L` 单独点击邻接边。
6. 在 Direction Layers 中分别调整各方向；使用 `C` 点击交点切换 Over / Under。
7. 使用 `X` 拖出切割线，在右侧选择范围与保留方式后应用；使用 `S` 手动添加竹条。
8. 选择过渡区后替换策略，调整宽度、阶段、平滑度和复杂度，或删除/重新生成。
9. 点击“从图片提取纹样”生成并校正新的结构纹样。
10. 切换 `3D Realistic` 检查实体条带和过渡曲线。

## 架构

- `src/types`：V4 Document、Direction Layer、Strip Override、Cut Line、Crossing Rule 和 Transition Strategy 模型
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

更完整的透视校正、中心线手动描摹、自动 Bridge 搜索、多区域 Junction 和 Web Worker 缓存仍属于后续 P1/P2。
