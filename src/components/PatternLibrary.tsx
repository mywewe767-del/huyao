"use client";

import { ImagePlus, Layers3, Search, Shapes } from "lucide-react";
import { useMemo, useState } from "react";
import { PATTERNS } from "@/patterns/library";
import { useStudioStore } from "@/store/useStudioStore";
import type { PatternDefinition } from "@/types/weave";
import { ImagePatternImporter } from "./ImagePatternImporter";
import { LayerPanel } from "./LayerPanel";

function PatternGlyph({ pattern }: { pattern: PatternDefinition }) {
  const patternId = pattern.id;
  return <svg viewBox="0 0 64 52" aria-hidden="true"><defs><clipPath id={`thumb-${patternId}`}><rect x="1" y="1" width="62" height="50" rx="5" /></clipPath></defs><g clipPath={`url(#thumb-${patternId})`}><rect width="64" height="52" fill="#f3ecdf" />{pattern.directionLayers.flatMap((layer, group) => Array.from({ length: Math.max(4, Math.round(10 * layer.density / 100)) }, (_, index) => <line key={`${group}-${index}`} x1="-22" y1={index * 9 - 6} x2="86" y2={index * 9 - 6} stroke={["#b68b4c", "#75865c", "#a5755f", "#647f8c"][group % 4]} strokeWidth={Math.max(1.4, layer.stripWidth / 1.8)} transform={`rotate(${layer.angle} 32 26)`} opacity=".9" />))}</g></svg>;
}

export function PatternLibrary() {
  const [tab, setTab] = useState<"patterns" | "layers">("patterns");
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const customPatterns = useStudioStore((state) => state.project.customPatterns);
  const selectedPatternId = useStudioStore((state) => state.selectedPatternId);
  const selectedRegionId = useStudioStore((state) => state.selectedRegionId);
  const setSelectedPattern = useStudioStore((state) => state.setSelectedPattern);
  const applyPattern = useStudioStore((state) => state.applyPattern);
  const items = useMemo(() => [...PATTERNS, ...customPatterns].filter((pattern) => `${pattern.nameZh} ${pattern.nameEn}`.toLowerCase().includes(query.toLowerCase())), [customPatterns, query]);
  const choose = (id: string) => { setSelectedPattern(id); if (selectedRegionId) applyPattern(selectedRegionId, id); };
  return <aside className="panel library-panel">
    <div className="library-tabs"><button className={tab === "patterns" ? "active" : ""} onClick={() => setTab("patterns")}><Shapes />纹样</button><button className={tab === "layers" ? "active" : ""} onClick={() => setTab("layers")}><Layers3 />图层</button></div>
    {tab === "layers" ? <LayerPanel /> : <>
      <div className="panel-title-row"><div><span className="eyebrow">STRUCTURAL DEFINITIONS · V3</span><h2>纹样库</h2></div><span className="count-badge">{PATTERNS.length + customPatterns.length}</span></div>
      <label className="library-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索纹样" /></label>
      <div className="pattern-list v2">{items.map((pattern) => <button className={`pattern-card ${selectedPatternId === pattern.id ? "is-active" : ""}`} key={pattern.id} onClick={() => choose(pattern.id)}><span className="pattern-thumb"><PatternGlyph pattern={pattern} /></span><span className="pattern-copy"><strong>{pattern.nameZh}</strong><small>{pattern.nameEn}</small><em>{pattern.directionLayers.length} 个方向层 · {pattern.crossingRules.length} 组交织</em></span></button>)}</div>
      <button className="import-pattern-button" onClick={() => setImporting(true)}><ImagePlus />从图片提取纹样 <span>可编辑</span></button>{importing ? <ImagePatternImporter onClose={() => setImporting(false)} /> : null}
    </>}
  </aside>;
}
