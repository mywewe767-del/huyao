# Bamboo Weave Studio — MVP

面向竹编设计的参数化 Web 编辑器。当前版本实现两个矩形区域、6 种程序化纹样、显式 Over/Under 交叉、密度过渡、2D/3D 同步预览、历史记录、自动保存、项目 JSON 与 PNG 导出。

## 运行

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。推荐桌面浏览器，最小视口宽度 1080px。

## MVP 操作流程

1. 在左侧选择纹样，点击样板的左/右区域应用。
2. 拖动样板中央绿色手柄调整两个区域大小。
3. 在右侧修改当前区域的密度、方向、经纬宽度和颜色。
4. 点击 2D 条带可进入单根竹条编辑。
5. 在“基础过渡”中设置宽度并生成过渡。
6. 底部切换 `2D Structure` / `3D Realistic`。
7. 顶部保存或读取 `.bamboo.json`，并导出 PNG。

## 代码边界

- `src/types`：统一项目、纹样、区域、条带与 Crossing 模型
- `src/patterns`：数据驱动纹样目录
- `src/engine`：独立的几何、纹样生成和过渡算法
- `src/components`：编辑器与 2D/3D 渲染层
- `src/store`：Zustand 项目状态、50 步 Undo/Redo
- `src/utils`：文件读取与导出

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
```
