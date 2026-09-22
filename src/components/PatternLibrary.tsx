"use client";

import { PATTERNS } from "@/patterns/library";
import { getPattern } from "@/patterns/library";
import { useStudioStore } from "@/store/useStudioStore";

function PatternGlyph({ patternId }: { patternId: string }) {
  const pattern = getPattern(patternId);
  const angles = pattern.structure.directions;
  return (
    <svg viewBox="0 0 64 52" aria-hidden="true">
      <defs><clipPath id={`thumb-${patternId}`}><rect x="1" y="1" width="62" height="50" rx="5" /></clipPath></defs>
      <g clipPath={`url(#thumb-${patternId})`}>
        <rect width="64" height="52" fill="#f3ecdf" />
        {angles.flatMap((angle, group) => Array.from({ length: 9 }, (_, index) => (
          <line key={`${group}-${index}`} x1="-20" y1={index * 8 - 6} x2="84" y2={index * 8 - 6}
            stroke={group === 0 ? "#b68b4c" : group === 1 ? "#75865c" : "#c49a62"}
            strokeWidth={group === 2 ? 2.2 : 3.2} transform={`rotate(${angle} 32 26)`} opacity="0.9" />
        )))}
      </g>
    </svg>
  );
}

export function PatternLibrary() {
  const selectedPatternId = useStudioStore((state) => state.selectedPatternId);
  const setSelectedPattern = useStudioStore((state) => state.setSelectedPattern);
  return (
    <aside className="panel library-panel">
      <div className="panel-title-row"><div><span className="eyebrow">LIBRARY</span><h2>纹样库</h2></div><span className="count-badge">06</span></div>
      <p className="panel-hint">选择纹样，再点击样板区域应用</p>
      <div className="pattern-list">
        {PATTERNS.map((pattern) => (
          <button className={`pattern-card ${selectedPatternId === pattern.id ? "is-active" : ""}`} key={pattern.id} onClick={() => setSelectedPattern(pattern.id)}>
            <span className="pattern-thumb"><PatternGlyph patternId={pattern.id} /></span>
            <span className="pattern-copy"><strong>{pattern.nameZh}</strong><small>{pattern.nameEn}</small><em>{pattern.category} · {pattern.defaultDensity}%</em></span>
          </button>
        ))}
      </div>
      <div className="library-note"><span>参数化结构</span><strong>6 / 6</strong><p>所有纹样均由方向、间距和穿插规则实时生成。</p></div>
    </aside>
  );
}
