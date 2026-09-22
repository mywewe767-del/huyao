"use client";

import { Route, WandSparkles } from "lucide-react";
import { detectAdjacencies } from "@/engine/adjacency";
import { bounds } from "@/engine/geometry";
import { getPattern, PATTERNS } from "@/patterns/library";
import { useStudioStore } from "@/store/useStudioStore";

function NumberField({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return <label className="field-row"><span>{label}</span><span className="number-input"><input type="number" value={Number(value.toFixed(1))} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><em>{unit}</em></span></label>;
}
function RangeField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return <label className="range-field"><span><b>{label}</b><output>{Math.round(value)}{unit}</output></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field-row color-field"><span>{label}</span><span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></span></label>;
}

export function PropertyPanel() {
  const project = useStudioStore((state) => state.project);
  const selectedRegionId = useStudioStore((state) => state.selectedRegionId);
  const selectedTransitionId = useStudioStore((state) => state.selectedTransitionId);
  const selectedStripId = useStudioStore((state) => state.selectedStripId);
  const region = project.regions.find((item) => item.id === selectedRegionId);
  const transition = project.transitions.find((item) => item.id === selectedTransitionId);
  const pattern = region ? getPattern(region.pattern.patternId, project.customPatterns) : null;
  const box = region ? bounds(region.boundary) : null;
  const adjacencies = detectAdjacencies(project.regions);
  const actions = useStudioStore.getState();
  return <aside className="panel property-panel">
    <div className="panel-title-row"><div><span className="eyebrow">INSPECTOR · V2</span><h2>属性</h2></div><span className="selection-pill">{transition ? "过渡" : selectedStripId ? "竹条" : region ? "区域" : "画板"}</span></div>
    <div className="inspector-scroll">
      {!region && !transition ? <>
        <section className="property-section"><h3>画板</h3><div className="two-columns"><NumberField label="宽" value={project.canvas.width} min={160} max={1000} unit="mm" onChange={(value) => actions.updateCanvas(value, project.canvas.height)} /><NumberField label="高" value={project.canvas.height} min={120} max={800} unit="mm" onChange={(value) => actions.updateCanvas(project.canvas.width, value)} /></div>
          <label className="check-row"><span>显示网格</span><input type="checkbox" checked={project.canvas.gridVisible} onChange={(event) => actions.updateCanvasConfig({ gridVisible: event.target.checked })} /></label>
          <label className="check-row"><span>吸附网格</span><input type="checkbox" checked={project.canvas.snapEnabled} onChange={(event) => actions.updateCanvasConfig({ snapEnabled: event.target.checked })} /></label>
          <NumberField label="网格大小" value={project.canvas.gridSize} min={2} max={50} unit="mm" onChange={(value) => actions.updateCanvasConfig({ gridSize: value })} />
          <label className="select-field"><span>背景纹样</span><select value={project.canvas.basePatternId} onChange={(event) => actions.applyPattern("background", event.target.value)}>{PATTERNS.map((item) => <option key={item.id} value={item.id}>{item.nameZh}</option>)}</select></label>
        </section>
        <section className="property-section transition-summary"><h3>结构关系</h3><div className="metric-grid"><div><strong>{project.regions.length - 1}</strong><span>设计区域</span></div><div><strong>{adjacencies.length}</strong><span>检测邻接</span></div><div><strong>{project.transitions.length}</strong><span>结构过渡</span></div></div><button className="generate-button primary" disabled={!adjacencies.length} onClick={() => actions.generateAllTransitions(adjacencies)}><WandSparkles />生成全部结构过渡</button></section>
      </> : null}
      {region && pattern && box ? <>
        <section className="property-section"><h3>区域 <small>{region.boundary.length} 个节点</small></h3><label className="text-field"><span>名称</span><input value={region.name} onChange={(event) => actions.updateRegion(region.id, { name: event.target.value })} /></label><label className="select-field"><span>纹样实例</span><select value={region.pattern.patternId} onChange={(event) => actions.applyPattern(region.id, event.target.value)}>{PATTERNS.map((item) => <option key={item.id} value={item.id}>{item.nameZh} / {item.nameEn}</option>)}</select></label><p className="pattern-description">{pattern.description} · 开放度 {Math.round(pattern.topology.openness * 100)}%</p></section>
        <section className="property-section"><h3>变换</h3><div className="two-columns"><NumberField label="X" value={box.x} min={-500} max={1000} unit="mm" onChange={(value) => actions.moveRegion(region.id, value - box.x, 0)} /><NumberField label="Y" value={box.y} min={-500} max={1000} unit="mm" onChange={(value) => actions.moveRegion(region.id, 0, value - box.y)} /><NumberField label="宽" value={box.width} min={10} max={1000} unit="mm" onChange={(value) => actions.resizeRegion(region.id, value / Math.max(1, box.width), 1)} /><NumberField label="高" value={box.height} min={10} max={800} unit="mm" onChange={(value) => actions.resizeRegion(region.id, 1, value / Math.max(1, box.height))} /></div><NumberField label="旋转" value={region.pattern.rotation} min={-180} max={180} unit="°" onChange={(value) => actions.rotateRegion(region.id, value - region.pattern.rotation)} /></section>
        <section className="property-section"><h3>编织参数</h3><RangeField label="密度" value={region.pattern.density} min={25} max={92} unit="%" onChange={(value) => actions.updatePatternInstance(region.id, { density: value })} /><RangeField label="缩放" value={region.pattern.scale * 100} min={40} max={220} unit="%" onChange={(value) => actions.updatePatternInstance(region.id, { scale: value / 100 })} /><NumberField label="默认竹条宽" value={region.pattern.stripWidth} min={1} max={14} step={.5} unit="mm" onChange={(value) => actions.updatePatternInstance(region.id, { stripWidth: value })} />{pattern.structure.directions.map((angle, index) => <div className="direction-row" key={`${angle}-${index}`}><span><i style={{ transform: `rotate(${angle}deg)` }} />方向 {angle}°</span><NumberField label="" value={region.pattern.directionWidths[String(index)] ?? region.pattern.stripWidth} min={1} max={14} step={.5} unit="mm" onChange={(value) => actions.updatePatternInstance(region.id, { directionWidths: { ...region.pattern.directionWidths, [String(index)]: value } })} /><input type="color" value={region.pattern.directionColors[String(index)] ?? region.color} onChange={(event) => actions.updatePatternInstance(region.id, { directionColors: { ...region.pattern.directionColors, [String(index)]: event.target.value } })} /></div>)}</section>
        <section className="property-section"><h3>外观与图层</h3><ColorField label="区域基色" value={region.color} onChange={(value) => actions.updateRegion(region.id, { color: value })} /><label className="check-row"><span>显示</span><input type="checkbox" checked={region.visible} onChange={(event) => actions.updateRegion(region.id, { visible: event.target.checked })} /></label><label className="check-row"><span>锁定</span><input type="checkbox" checked={region.locked} onChange={(event) => actions.updateRegion(region.id, { locked: event.target.checked })} /></label></section>
        {selectedStripId ? <section className="property-section strip-section"><h3>单根竹条</h3><code className="strip-id">{selectedStripId}</code><ColorField label="颜色覆盖" value={region.pattern.localOverrides[selectedStripId]?.color ?? region.color} onChange={(value) => actions.updateStrip(region.id, selectedStripId, { color: value })} /><NumberField label="宽度覆盖" value={region.pattern.localOverrides[selectedStripId]?.width ?? region.pattern.stripWidth} min={1} max={14} step={.5} unit="mm" onChange={(value) => actions.updateStrip(region.id, selectedStripId, { width: value })} /></section> : null}
      </> : null}
      {transition ? <><section className="property-section"><div className="transition-heading"><div><h3>结构过渡</h3><p>{transition.regionIds.join(" ↔ ")}</p></div><Route /></div><label className="text-field"><span>名称</span><input value={transition.name} onChange={(event) => actions.updateTransition(transition.id, { name: event.target.value })} /></label><label className="select-field"><span>模式</span><select value={transition.mode} onChange={(event) => actions.updateTransition(transition.id, { mode: event.target.value as typeof transition.mode })}><option value="natural">Natural · 视觉连续</option><option value="structural">Structural · 可编织优先</option><option value="experimental">Experimental · 合并分叉</option></select></label></section><section className="property-section"><h3>连续变化</h3><RangeField label="过渡宽度" value={transition.width} min={16} max={140} unit="mm" onChange={(value) => actions.updateTransition(transition.id, { width: value })} /><RangeField label="平滑度" value={transition.smoothness} min={0} max={100} unit="%" onChange={(value) => actions.updateTransition(transition.id, { smoothness: value })} /><RangeField label="复杂度" value={transition.complexity} min={0} max={100} unit="%" onChange={(value) => actions.updateTransition(transition.id, { complexity: value })} /><p className="transition-note">控制点、条带路径、宽度插值及 Merge/Split 节点均为可编辑结构数据。</p></section></> : null}
      <section className="property-section"><h3>3D 材料</h3><NumberField label="竹条厚度" value={project.appearance.thickness} min={.4} max={4} step={.2} unit="mm" onChange={(value) => actions.updateAppearance({ thickness: value })} /></section>
    </div>
  </aside>;
}
