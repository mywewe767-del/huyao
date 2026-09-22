"use client";

import { ImagePlus, Layers3, Search, Shapes } from "lucide-react";
import { useMemo, useState } from "react";
import { getPattern, PATTERNS } from "@/patterns/library";
import { useStudioStore } from "@/store/useStudioStore";
import { LayerPanel } from "./LayerPanel";

function PatternGlyph({ patternId }: { patternId: string }) {
  const pattern = getPattern(patternId);
  return <svg viewBox="0 0 64 52" aria-hidden="true"><defs><clipPath id={`thumb-${patternId}`}><rect x="1" y="1" width="62" height="50" rx="5" /></clipPath></defs><g clipPath={`url(#thumb-${patternId})`}><rect width="64" height="52" fill="#f3ecdf" />{pattern.structure.directions.flatMap((angle, group) => Array.from({ length: 8 }, (_, index) => <line key={`${group}-${index}`} x1="-22" y1={index * 9 - 6} x2="86" y2={index * 9 - 6} stroke={["#b68b4c", "#75865c", "#a5755f", "#647f8c"][group % 4]} strokeWidth={group > 1 ? 2.1 : 3} transform={`rotate(${angle} 32 26)`} opacity=".9" />))}</g></svg>;
}

export function PatternLibrary() {
  const [tab, setTab] = useState<"patterns" | "layers">("patterns");
  const [query, setQuery] = useState("");
  const selectedPatternId = useStudioStore((state) => state.selectedPatternId);
  const selectedRegionId = useStudioStore((state) => state.selectedRegionId);
  const setSelectedPattern = useStudioStore((state) => state.setSelectedPattern);
  const applyPattern = useStudioStore((state) => state.applyPattern);
  const items = useMemo(() => PATTERNS.filter((pattern) => `${pattern.nameZh} ${pattern.nameEn}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const choose = (id: string) => { setSelectedPattern(id); if (selectedRegionId) applyPattern(selectedRegionId, id); };
  return <aside className="panel library-panel">
    <div className="library-tabs"><button className={tab === "patterns" ? "active" : ""} onClick={() => setTab("patterns")}><Shapes />纹样</button><button className={tab === "layers" ? "active" : ""} onClick={() => setTab("layers")}><Layers3 />图层</button></div>
    {tab === "layers" ? <LayerPanel /> : <>
      <div className="panel-title-row"><div><span className="eyebrow">PARAMETRIC LIBRARY</span><h2>纹样库</h2></div><span className="count-badge">{PATTERNS.length}</span></div>
      <label className="library-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索纹样" /></label>
      <div className="pattern-list v2">{items.map((pattern) => <button className={`pattern-card ${selectedPatternId === pattern.id ? "is-active" : ""}`} key={pattern.id} onClick={() => choose(pattern.id)}><span className="pattern-thumb"><PatternGlyph patternId={pattern.id} /></span><span className="pattern-copy"><strong>{pattern.nameZh}</strong><small>{pattern.nameEn}</small><em>{pattern.structure.directions.length} 向 · {pattern.defaultDensity}%</em></span></button>)}</div>
      <button className="import-pattern-button" disabled title="将在 P1 图片识别阶段启用"><ImagePlus />从图片提取纹样 <span>P1</span></button>
    </>}
  </aside>;
}
