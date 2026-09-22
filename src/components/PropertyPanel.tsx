"use client";

import { getPattern, PATTERNS } from "@/patterns/library";
import { useStudioStore } from "@/store/useStudioStore";

function NumberField({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return <label className="field-row"><span>{label}</span><span className="number-input"><input type="number" value={Number(value.toFixed(1))} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><em>{unit}</em></span></label>;
}

function RangeField({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return <label className="range-field"><span><b>{label}</b><output>{value}{unit}</output></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field-row color-field"><span>{label}</span><span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></span></label>;
}

export function PropertyPanel() {
  const state = useStudioStore();
  const { project, selectedRegionId, selectedStripId, selectedDirection, updateRegion, updateAppearance, updateStrip, updateTransition, updateCanvas, setDirection } = state;
  const region = project.regions.find((item) => item.id === selectedRegionId);
  const override = selectedStripId ? project.appearance.stripOverrides[selectedStripId] : undefined;
  return (
    <aside className="panel property-panel">
      <div className="panel-title-row"><div><span className="eyebrow">INSPECTOR</span><h2>属性</h2></div><span className="selection-pill">{selectedStripId ? "单根竹条" : region ? "区域" : "整体"}</span></div>
      <div className="inspector-scroll">
        <section className="property-section">
          <h3>样板</h3>
          <div className="two-columns">
            <NumberField label="宽" value={project.canvas.width} min={160} max={600} unit="mm" onChange={(value) => updateCanvas(value, project.canvas.height)} />
            <NumberField label="高" value={project.canvas.height} min={120} max={400} unit="mm" onChange={(value) => updateCanvas(project.canvas.width, value)} />
          </div>
        </section>
        {region ? <section className="property-section">
          <h3>区域结构 <small>{region.name}</small></h3>
          <label className="select-field"><span>纹样</span><select value={region.patternId} onChange={(event) => updateRegion(region.id, { patternId: event.target.value })}>{PATTERNS.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.nameZh} / {pattern.nameEn}</option>)}</select></label>
          <p className="pattern-description">{getPattern(region.patternId).description}</p>
          <RangeField label="密度" value={region.density} min={30} max={92} unit="%" onChange={(value) => updateRegion(region.id, { density: value })} />
          <RangeField label="方向" value={region.rotation} min={-90} max={90} unit="°" onChange={(value) => updateRegion(region.id, { rotation: value })} />
          <div className="segmented" aria-label="编辑方向">{(["all", "warp", "weft"] as const).map((direction) => <button key={direction} className={selectedDirection === direction ? "active" : ""} onClick={() => setDirection(direction)}>{direction === "all" ? "全部" : direction === "warp" ? "经线" : "纬线"}</button>)}</div>
          {(selectedDirection === "all" || selectedDirection === "warp") ? <NumberField label="经线宽度" value={region.warpWidth} min={1} max={12} step={.5} unit="mm" onChange={(value) => updateRegion(region.id, { warpWidth: value })} /> : null}
          {(selectedDirection === "all" || selectedDirection === "weft") ? <NumberField label="纬线宽度" value={region.weftWidth} min={1} max={12} step={.5} unit="mm" onChange={(value) => updateRegion(region.id, { weftWidth: value })} /> : null}
          <ColorField label="区域经线" value={region.warpColor ?? project.appearance.warpColor} onChange={(value) => updateRegion(region.id, { warpColor: value })} />
          <ColorField label="区域纬线" value={region.weftColor ?? project.appearance.weftColor} onChange={(value) => updateRegion(region.id, { weftColor: value })} />
        </section> : null}
        {selectedStripId ? <section className="property-section strip-section"><h3>单根竹条 <small>已覆盖</small></h3><code className="strip-id">{selectedStripId}</code><ColorField label="竹条颜色" value={override?.color ?? project.appearance.globalColor} onChange={(value) => updateStrip(selectedStripId, { color: value })} /><NumberField label="竹条宽度" value={override?.width ?? 5} min={1} max={12} step={.5} unit="mm" onChange={(value) => updateStrip(selectedStripId, { width: value })} /></section> : null}
        <section className="property-section">
          <h3>整体外观</h3>
          <ColorField label="整体基色" value={project.appearance.globalColor} onChange={(value) => updateAppearance({ globalColor: value, warpColor: value, weftColor: value })} />
          <ColorField label="全局经线" value={project.appearance.warpColor} onChange={(value) => updateAppearance({ warpColor: value })} />
          <ColorField label="全局纬线" value={project.appearance.weftColor} onChange={(value) => updateAppearance({ weftColor: value })} />
          <NumberField label="竹条厚度" value={project.appearance.thickness} min={.4} max={3} step={.2} unit="mm" onChange={(value) => updateAppearance({ thickness: value })} />
        </section>
        <section className="property-section transition-section">
          <div className="transition-heading"><div><h3>基础过渡</h3><p>密度与条带间距线性连续</p></div><button className={`toggle ${project.transition.enabled ? "on" : ""}`} aria-label="启用基础过渡" onClick={() => updateTransition({ enabled: !project.transition.enabled })}><span /></button></div>
          <RangeField label="过渡宽度" value={project.transition.width} min={20} max={100} unit="mm" onChange={(value) => updateTransition({ width: value })} />
          <button className="generate-button" onClick={() => updateTransition({ enabled: true })}>{project.transition.enabled ? "重新生成过渡" : "生成两个区域的过渡"}</button>
        </section>
      </div>
    </aside>
  );
}
