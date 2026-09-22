"use client";

import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import { getPattern } from "@/patterns/library";
import { useStudioStore } from "@/store/useStudioStore";

export function LayerPanel() {
  const project = useStudioStore((state) => state.project);
  const selectedRegionId = useStudioStore((state) => state.selectedRegionId);
  const selectedTransitionId = useStudioStore((state) => state.selectedTransitionId);
  const { selectRegion, selectTransition, updateRegion, deleteRegion, duplicateRegion, reorderRegion, updateTransition, deleteTransition } = useStudioStore.getState();
  return <div className="layer-list">
    <div className="layer-group-title">TRANSITIONS <span>{project.transitions.length}</span></div>
    {project.transitions.toReversed().map((transition) => <div key={transition.id} className={`layer-row ${selectedTransitionId === transition.id ? "active" : ""}`} onClick={() => selectTransition(transition.id)}>
      <span className="layer-swatch transition-swatch" /><span className="layer-name"><strong>{transition.name}</strong><small>{transition.mode}</small></span>
      <button title={transition.visible ? "隐藏" : "显示"} onClick={(event) => { event.stopPropagation(); updateTransition(transition.id, { visible: !transition.visible }); }}>{transition.visible ? <Eye /> : <EyeOff />}</button>
      <button title="删除" onClick={(event) => { event.stopPropagation(); deleteTransition(transition.id); }}><Trash2 /></button>
    </div>)}
    <div className="layer-group-title">REGIONS <span>{project.regions.length}</span></div>
    {project.regions.toSorted((a, b) => b.order - a.order).map((region) => <div key={region.id} className={`layer-row ${selectedRegionId === region.id ? "active" : ""}`} onClick={() => selectRegion(region.id)}>
      <span className="layer-swatch" style={{ background: region.color }} /><span className="layer-name"><strong>{region.name}</strong><small>{getPattern(region.pattern.patternId, project.customPatterns).nameZh}</small></span>
      <button title={region.visible ? "隐藏" : "显示"} onClick={(event) => { event.stopPropagation(); updateRegion(region.id, { visible: !region.visible }); }}>{region.visible ? <Eye /> : <EyeOff />}</button>
      <button title={region.locked ? "解锁" : "锁定"} onClick={(event) => { event.stopPropagation(); updateRegion(region.id, { locked: !region.locked }); }}>{region.locked ? <Lock /> : <Unlock />}</button>
      {region.id !== "background" ? <span className="layer-actions"><button title="上移" onClick={(event) => { event.stopPropagation(); reorderRegion(region.id, 1); }}><ChevronUp /></button><button title="下移" onClick={(event) => { event.stopPropagation(); reorderRegion(region.id, -1); }}><ChevronDown /></button><button title="复制" onClick={(event) => { event.stopPropagation(); duplicateRegion(region.id); }}><Copy /></button><button title="删除" onClick={(event) => { event.stopPropagation(); deleteRegion(region.id); }}><Trash2 /></button></span> : null}
    </div>)}
  </div>;
}
