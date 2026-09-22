"use client";

import { useMemo, useRef, useState } from "react";
import { generateProjectWeave } from "@/engine/patternGenerator";
import { generateDensityTransition } from "@/engine/transition";
import { useStudioStore } from "@/store/useStudioStore";
import type { StripGeometry } from "@/types/weave";

const toPoints = (strip: StripGeometry) => strip.path.map((point) => `${point.x},${point.y}`).join(" ");

export function WeaveCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const { project, selectedPatternId, selectedRegionId, selectedStripId, zoom, applyPattern, selectRegion, selectStrip, resizeBoundary } = useStudioStore();
  const weave = useMemo(() => generateProjectWeave(project.regions, project.appearance), [project.regions, project.appearance]);
  const transition = useMemo(() => generateDensityTransition(project.regions[0], project.regions[1], project.transition, project.appearance), [project.regions, project.transition, project.appearance]);
  const boundaryX = project.regions[0].boundary[1].x;
  const moveBoundary = (clientX: number) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return;
    resizeBoundary((clientX - matrix.e) / matrix.a);
  };
  return (
    <div className="canvas-scroll">
      <div className="canvas-stage" style={{ width: `${zoom * 100}%` }}>
        <svg ref={svgRef} id="bamboo-structure-svg" className="weave-svg" viewBox={`-8 -8 ${project.canvas.width + 16} ${project.canvas.height + 16}`}
          onPointerMove={(event) => { if (dragging) moveBoundary(event.clientX); }} onPointerUp={() => setDragging(false)} onPointerLeave={() => setDragging(false)}>
          <defs>
            <pattern id="minor-grid" width={project.canvas.gridSize} height={project.canvas.gridSize} patternUnits="userSpaceOnUse"><path d={`M ${project.canvas.gridSize} 0 L 0 0 0 ${project.canvas.gridSize}`} fill="none" stroke="#8c877e" strokeOpacity=".12" strokeWidth=".4" /></pattern>
            {project.regions.map((region) => <clipPath id={`clip-${region.id}`} key={region.id}><polygon points={region.boundary.map((point) => `${point.x},${point.y}`).join(" ")} /></clipPath>)}
            <clipPath id="clip-canvas"><rect width={project.canvas.width} height={project.canvas.height} /></clipPath>
            <filter id="strip-shadow"><feDropShadow dx="0" dy="0.55" stdDeviation="0.35" floodOpacity=".32" /></filter>
          </defs>
          <rect width={project.canvas.width} height={project.canvas.height} rx="1" fill="#f7f2e8" />
          <rect width={project.canvas.width} height={project.canvas.height} fill="url(#minor-grid)" />
          {project.regions.map((region) => (
            <g key={region.id} clipPath={`url(#clip-${region.id})`}>
              <polygon points={region.boundary.map((point) => `${point.x},${point.y}`).join(" ")} fill={selectedRegionId === region.id ? "#d8a84e" : "transparent"} opacity=".07" />
              <polygon points={region.boundary.map((point) => `${point.x},${point.y}`).join(" ")} fill="transparent" className="region-hit" onClick={() => { selectRegion(region.id); applyPattern(region.id, selectedPatternId); }} />
              {weave.strips.filter((strip) => strip.regionId === region.id).map((strip) => (
                <polyline key={strip.id} points={toPoints(strip)} fill="none" stroke={strip.color} strokeWidth={strip.width} strokeLinecap="round" strokeLinejoin="round"
                  opacity={selectedStripId && selectedStripId !== strip.id ? .68 : 1} className="woven-strip" onPointerDown={(event) => { event.stopPropagation(); selectRegion(region.id); selectStrip(strip.id); }} />
              ))}
              {weave.crossings.filter((crossing) => crossing.stripA.startsWith(region.id)).map((crossing) => {
                const over = weave.strips.find((strip) => strip.id === crossing.overStripId);
                if (!over) return null;
                const radians = over.angle * Math.PI / 180;
                const length = Math.max(6, over.width * 1.9);
                const dx = Math.cos(radians) * length / 2;
                const dy = Math.sin(radians) * length / 2;
                return <g key={crossing.id} pointerEvents="none" filter="url(#strip-shadow)">
                  <line x1={crossing.position.x - dx} y1={crossing.position.y - dy} x2={crossing.position.x + dx} y2={crossing.position.y + dy} stroke="#f7f2e8" strokeWidth={over.width + 1.7} strokeLinecap="round" />
                  <line x1={crossing.position.x - dx} y1={crossing.position.y - dy} x2={crossing.position.x + dx} y2={crossing.position.y + dy} stroke={over.color} strokeWidth={over.width} strokeLinecap="round" />
                </g>;
              })}
            </g>
          ))}
          {project.transition.enabled ? <g clipPath="url(#clip-canvas)" className="transition-zone">
            <rect x={boundaryX - project.transition.width / 2} width={project.transition.width} height={project.canvas.height} fill="#f7f2e8" opacity=".9" />
            {transition.strips.map((strip) => <polyline key={strip.id} points={toPoints(strip)} fill="none" stroke={strip.color} strokeWidth={strip.width} strokeLinecap="round" strokeLinejoin="round" />)}
            <line x1={boundaryX - project.transition.width / 2} x2={boundaryX - project.transition.width / 2} y1="0" y2={project.canvas.height} stroke="#b7791f" strokeDasharray="3 3" strokeWidth=".7" />
            <line x1={boundaryX + project.transition.width / 2} x2={boundaryX + project.transition.width / 2} y1="0" y2={project.canvas.height} stroke="#b7791f" strokeDasharray="3 3" strokeWidth=".7" />
          </g> : null}
          <rect width={project.canvas.width} height={project.canvas.height} fill="none" stroke="#59564e" strokeWidth="1.2" />
          <g data-export-ignore onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }} className="boundary-handle">
            <line x1={boundaryX} x2={boundaryX} y1="0" y2={project.canvas.height} stroke="#305f52" strokeWidth="1" strokeDasharray="4 3" />
            <rect x={boundaryX - 3.5} y={project.canvas.height / 2 - 12} width="7" height="24" rx="3.5" fill="#305f52" />
            <circle cx={boundaryX} cy={project.canvas.height / 2 - 3} r=".8" fill="white" /><circle cx={boundaryX} cy={project.canvas.height / 2 + 3} r=".8" fill="white" />
          </g>
        </svg>
      </div>
    </div>
  );
}
