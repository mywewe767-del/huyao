"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectAdjacencies } from "@/engine/adjacency";
import { bounds, centroid, distance, simplifyPath, snapPoint } from "@/engine/geometry";
import { generateDocumentWeave } from "@/engine/patternGenerator";
import { generateTransition } from "@/engine/transition";
import { useStudioStore } from "@/store/useStudioStore";
import type { Point, StripGeometry } from "@/types/weave";

const points = (value: Point[]) => value.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
const pathData = (strip: StripGeometry) => strip.path.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");

function brushPolygon(path: Point[], size: number): Point[] {
  const simple = simplifyPath(path, Math.max(2, size / 7));
  if (simple.length < 2) return [];
  const upper: Point[] = []; const lower: Point[] = [];
  simple.forEach((point, index) => {
    const previous = simple[Math.max(0, index - 1)]; const next = simple[Math.min(simple.length - 1, index + 1)];
    const length = Math.max(1, distance(previous, next)); const nx = -(next.y - previous.y) / length; const ny = (next.x - previous.x) / length;
    upper.push({ x: point.x + nx * size / 2, y: point.y + ny * size / 2 }); lower.unshift({ x: point.x - nx * size / 2, y: point.y - ny * size / 2 });
  });
  return [...upper, ...lower];
}

type DragMode = "move" | "resize" | "rotate" | "node" | "transition-node" | "pan" | null;

export function WeaveCanvas() {
  const svgRef = useRef<SVGSVGElement>(null); const contentRef = useRef<SVGGElement>(null);
  const dragMode = useRef<DragMode>(null); const dragRegionId = useRef<string | null>(null); const nodeIndex = useRef(-1); const lastPoint = useRef<Point | null>(null);
  const dragTransitionId = useRef<string | null>(null);
  const [draft, setDraft] = useState<Point[]>([]); const [rectStart, setRectStart] = useState<Point | null>(null); const [cursor, setCursor] = useState<Point | null>(null); const [spaceDown, setSpaceDown] = useState(false);
  const state = useStudioStore();
  const { project, activeTool, selectedRegionId, selectedStripId, selectedTransitionId, selectedPatternId, zoom, pan, brushSize } = state;
  const weave = useMemo(() => generateDocumentWeave(project.regions, project.appearance, project.customPatterns), [project.regions, project.appearance, project.customPatterns]);
  const stripMap = useMemo(() => new Map(weave.strips.map((strip) => [strip.id, strip])), [weave.strips]);
  const adjacencies = useMemo(() => detectAdjacencies(project.regions), [project.regions]);
  const regionMap = useMemo(() => new Map(project.regions.map((region) => [region.id, region])), [project.regions]);
  const adjacencyMap = useMemo(() => new Map(adjacencies.map((adjacency) => [adjacency.id, adjacency])), [adjacencies]);
  const transitionResults = useMemo(() => project.transitions.flatMap((zone) => {
    const adjacency = adjacencyMap.get(zone.adjacencyId); const a = regionMap.get(zone.regionIds[0]); const b = regionMap.get(zone.regionIds[1]);
    return adjacency && a && b && zone.enabled && zone.visible ? [{ zone, value: generateTransition(zone, adjacency, a, b, project.customPatterns) }] : [];
  }), [project.transitions, adjacencyMap, regionMap, project.customPatterns]);
  const selectedRegion = selectedRegionId ? regionMap.get(selectedRegionId) : undefined;

  const toCanvasPoint = useCallback((clientX: number, clientY: number): Point => {
    const matrix = contentRef.current?.getScreenCTM(); if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    const raw = { x: point.x, y: point.y };
    return project.canvas.snapEnabled && !spaceDown ? snapPoint(raw, project.canvas.gridSize) : raw;
  }, [project.canvas.gridSize, project.canvas.snapEnabled, spaceDown]);

  const finishPolygon = useCallback(() => {
    if (draft.length >= 3) state.addRegion(draft, selectedPatternId);
    setDraft([]);
  }, [draft, selectedPatternId, state]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space") { event.preventDefault(); setSpaceDown(true); }
      const shortcuts: Record<string, typeof activeTool> = { v: "select", a: "direct", r: "rectangle", p: "polygon", b: "brush", e: "eraser", l: "transition", g: "gradient", c: "crossing", h: "pan" };
      if (!event.ctrlKey && !event.metaKey && shortcuts[event.key.toLowerCase()]) state.setActiveTool(shortcuts[event.key.toLowerCase()]);
      if (event.key === "Enter") finishPolygon();
      if (event.key === "Delete" || event.key === "Backspace") { if (selectedTransitionId) state.deleteTransition(selectedTransitionId); else if (selectedRegionId) state.deleteRegion(selectedRegionId); }
      if (event.key === "Escape") { setDraft([]); setRectStart(null); }
    };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [activeTool, finishPolygon, selectedRegionId, selectedTransitionId, state]);

  const startRegionDrag = (event: React.PointerEvent, regionId: string) => {
    if (activeTool !== "select" && activeTool !== "direct" && activeTool !== "eraser") return;
    event.stopPropagation();
    if (activeTool === "eraser") { state.deleteRegion(regionId); return; }
    state.selectRegion(regionId); if (regionMap.get(regionId)?.locked || activeTool === "direct") return;
    dragMode.current = "move"; dragRegionId.current = regionId; lastPoint.current = toCanvasPoint(event.clientX, event.clientY); event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = toCanvasPoint(event.clientX, event.clientY); setCursor(point);
    if (activeTool === "pan" || spaceDown) { dragMode.current = "pan"; lastPoint.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); return; }
    if (activeTool === "rectangle") { setRectStart(point); setDraft([point, point]); event.currentTarget.setPointerCapture(event.pointerId); }
    else if (activeTool === "polygon") setDraft((current) => [...current, point]);
    else if (activeTool === "brush") { setDraft([point]); event.currentTarget.setPointerCapture(event.pointerId); }
    else if (activeTool === "select") state.selectRegion(null);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = toCanvasPoint(event.clientX, event.clientY); setCursor(point);
    if (dragMode.current === "pan" && lastPoint.current) { state.setPan({ x: pan.x + (event.clientX - lastPoint.current.x) / zoom, y: pan.y + (event.clientY - lastPoint.current.y) / zoom }); lastPoint.current = { x: event.clientX, y: event.clientY }; return; }
    if (dragMode.current === "move" && dragRegionId.current && lastPoint.current) { state.moveRegion(dragRegionId.current, point.x - lastPoint.current.x, point.y - lastPoint.current.y); lastPoint.current = point; return; }
    if (dragMode.current === "resize" && dragRegionId.current && lastPoint.current) { const region = regionMap.get(dragRegionId.current); if (region) { const box = bounds(region.boundary); state.resizeRegion(region.id, Math.max(.2, 1 + (point.x - lastPoint.current.x) / Math.max(1, box.width)), Math.max(.2, 1 + (point.y - lastPoint.current.y) / Math.max(1, box.height))); } lastPoint.current = point; return; }
    if (dragMode.current === "rotate" && dragRegionId.current && lastPoint.current) { const region = regionMap.get(dragRegionId.current); if (region) { const center = centroid(region.boundary); const before = Math.atan2(lastPoint.current.y - center.y, lastPoint.current.x - center.x); const after = Math.atan2(point.y - center.y, point.x - center.x); state.rotateRegion(region.id, (after - before) * 180 / Math.PI); } lastPoint.current = point; return; }
    if (dragMode.current === "node" && dragRegionId.current) { state.updateRegionPoint(dragRegionId.current, nodeIndex.current, point); return; }
    if (dragMode.current === "transition-node" && dragTransitionId.current) { const zone = project.transitions.find((item) => item.id === dragTransitionId.current); if (zone) state.updateTransition(zone.id, { controlPoints: zone.controlPoints.map((current, index) => index === nodeIndex.current ? point : current) }); return; }
    if (activeTool === "rectangle" && rectStart) setDraft([rectStart, point]);
    if (activeTool === "brush" && draft.length) setDraft((current) => [...current, point]);
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === "rectangle" && rectStart && draft[1] && distance(rectStart, draft[1]) > 8) {
      const end = draft[1]; state.addRegion([{ x: rectStart.x, y: rectStart.y }, { x: end.x, y: rectStart.y }, end, { x: rectStart.x, y: end.y }], selectedPatternId);
    }
    if (activeTool === "brush" && draft.length > 2) { const polygon = brushPolygon(draft, brushSize); if (polygon.length >= 3) state.addRegion(polygon, selectedPatternId); }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setRectStart(null); if (activeTool !== "polygon") setDraft([]); dragMode.current = null; dragRegionId.current = null; dragTransitionId.current = null; lastPoint.current = null;
  };

  const selectedBox = selectedRegion ? bounds(selectedRegion.boundary) : null;
  const transform = `translate(${pan.x} ${pan.y}) translate(${project.canvas.width / 2} ${project.canvas.height / 2}) scale(${zoom}) translate(${-project.canvas.width / 2} ${-project.canvas.height / 2})`;
  return <div className="canvas-scroll v2"><div className="canvas-stage v2">
    <svg ref={svgRef} id="bamboo-structure-svg" className={`weave-svg tool-${activeTool}`} viewBox={`-26 -26 ${project.canvas.width + 52} ${project.canvas.height + 52}`} onWheel={(event) => { event.preventDefault(); state.setZoom(zoom * (event.deltaY > 0 ? .9 : 1.1)); }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={() => activeTool === "polygon" && finishPolygon()}>
      <defs><pattern id="minor-grid" width={project.canvas.gridSize} height={project.canvas.gridSize} patternUnits="userSpaceOnUse"><path d={`M ${project.canvas.gridSize} 0 L 0 0 0 ${project.canvas.gridSize}`} fill="none" stroke="#787d75" strokeOpacity=".16" strokeWidth=".45" /></pattern>{project.regions.map((region) => <clipPath id={`clip-${region.id}`} key={region.id}><polygon points={points(region.boundary)} /></clipPath>)}<clipPath id="clip-canvas"><rect width={project.canvas.width} height={project.canvas.height} /></clipPath><filter id="strip-shadow"><feDropShadow dx="0" dy=".55" stdDeviation=".35" floodOpacity=".3" /></filter></defs>
      <g ref={contentRef} transform={transform}>
        <rect width={project.canvas.width} height={project.canvas.height} fill={project.canvas.backgroundColor} />
        {project.canvas.gridVisible ? <rect width={project.canvas.width} height={project.canvas.height} fill="url(#minor-grid)" /> : null}
        {project.regions.toSorted((a, b) => a.order - b.order).map((region) => <g key={region.id} clipPath={`url(#clip-${region.id})`} opacity={region.visible ? 1 : 0}>
          {region.id !== "background" ? <polygon points={points(region.boundary)} fill={project.canvas.backgroundColor} /> : null}
          <polygon points={points(region.boundary)} fill={selectedRegionId === region.id ? region.color : "transparent"} opacity=".12" onPointerDown={(event) => startRegionDrag(event, region.id)} />
          {weave.strips.filter((strip) => strip.regionId === region.id).map((strip) => <path key={strip.id} d={pathData(strip)} fill="none" stroke={strip.color} strokeWidth={strip.width} strokeLinecap="round" strokeLinejoin="round" opacity={selectedStripId && selectedStripId !== strip.id ? .68 : 1} className="woven-strip" onPointerDown={(event) => { event.stopPropagation(); state.selectRegion(region.id); state.selectStrip(strip.id); }} />)}
          {(() => { const regionCrossings = weave.crossings.filter((crossing) => crossing.stripA.startsWith(`${region.id}-`)); const stride = Math.max(1, Math.ceil(regionCrossings.length / 900)); return regionCrossings.filter((_, index) => index % stride === 0).map((crossing) => { const over = stripMap.get(crossing.overStripId); if (!over) return null; const radians = over.directionAngle * Math.PI / 180; const length = Math.max(6, over.width * 1.9); const dx = Math.cos(radians) * length / 2; const dy = Math.sin(radians) * length / 2; return <g key={crossing.id} filter="url(#strip-shadow)" className={activeTool === "crossing" ? "editable-crossing" : ""} onPointerDown={activeTool === "crossing" ? (event) => { event.stopPropagation(); state.selectRegion(region.id); state.toggleCrossing(region.id, crossing.id, crossing.stripA, crossing.stripB, crossing.overStripId); } : undefined}><line pointerEvents="none" x1={crossing.position.x - dx} y1={crossing.position.y - dy} x2={crossing.position.x + dx} y2={crossing.position.y + dy} stroke={project.canvas.backgroundColor} strokeWidth={over.width + 1.5} strokeLinecap="round" /><line pointerEvents="none" x1={crossing.position.x - dx} y1={crossing.position.y - dy} x2={crossing.position.x + dx} y2={crossing.position.y + dy} stroke={over.color} strokeWidth={over.width} strokeLinecap="round" />{activeTool === "crossing" ? <circle cx={crossing.position.x} cy={crossing.position.y} r={Math.max(3.5, over.width)} fill="transparent" stroke="#fff" strokeOpacity=".65" strokeWidth=".7" /> : null}</g>; }); })()}
          <polygon points={points(region.boundary)} fill="transparent" className="region-hit" onPointerDown={(event) => startRegionDrag(event, region.id)} />
        </g>)}
        {transitionResults.map(({ zone, value }) => <g key={zone.id} className={`transition-zone ${selectedTransitionId === zone.id ? "selected" : ""}`} onPointerDown={(event) => { event.stopPropagation(); state.selectTransition(zone.id); }}><polygon points={points(value.band)} fill={project.canvas.backgroundColor} opacity=".94" stroke="#b7791f" strokeWidth={selectedTransitionId === zone.id ? 1.8 : .7} strokeDasharray="4 3" />{value.strips.map((strip) => <path key={strip.id} d={pathData(strip)} fill="none" stroke={strip.color} strokeWidth={strip.width} strokeLinecap="round" strokeLinejoin="round" />)}{value.mergeNodes.map((node) => <circle key={node.id} cx={node.position.x} cy={node.position.y} r="2.2" fill="#d17b3f" />)}{value.splitNodes.map((node) => <rect key={node.id} x={node.position.x - 1.8} y={node.position.y - 1.8} width="3.6" height="3.6" transform={`rotate(45 ${node.position.x} ${node.position.y})`} fill="#547c78" />)}{zone.controlPoints.map((point, index) => selectedTransitionId === zone.id ? <circle className="transition-control" key={index} cx={point.x} cy={point.y} r="3.2" fill="white" stroke="#b7791f" strokeWidth="1" onPointerDown={(event) => { event.stopPropagation(); dragMode.current = "transition-node"; dragTransitionId.current = zone.id; nodeIndex.current = index; }} /> : null)}</g>)}
        {activeTool === "transition" ? adjacencies.map((adjacency) => <g key={adjacency.id} className="adjacency-preview" onPointerDown={(event) => { event.stopPropagation(); state.addTransition(adjacency); }}><line x1={adjacency.sharedBoundary[0].x} y1={adjacency.sharedBoundary[0].y} x2={adjacency.sharedBoundary[1].x} y2={adjacency.sharedBoundary[1].y} /><circle cx={adjacency.center.x} cy={adjacency.center.y} r="5" /><text x={adjacency.center.x} y={adjacency.center.y + 1}>+</text></g>) : null}
        {draft.length ? activeTool === "rectangle" && draft[1] ? <rect x={Math.min(draft[0].x, draft[1].x)} y={Math.min(draft[0].y, draft[1].y)} width={Math.abs(draft[1].x - draft[0].x)} height={Math.abs(draft[1].y - draft[0].y)} className="region-draft" /> : <><polyline points={points(draft)} className="region-draft-line" />{activeTool === "polygon" && cursor ? <line x1={draft.at(-1)!.x} y1={draft.at(-1)!.y} x2={cursor.x} y2={cursor.y} className="region-draft-line" /> : null}</> : null}
        {selectedRegion && selectedBox && activeTool !== "pan" ? <g className="selection-box"><rect x={selectedBox.x} y={selectedBox.y} width={selectedBox.width} height={selectedBox.height} /><line x1={selectedBox.x + selectedBox.width / 2} y1={selectedBox.y} x2={selectedBox.x + selectedBox.width / 2} y2={selectedBox.y - 13} /><circle cx={selectedBox.x + selectedBox.width / 2} cy={selectedBox.y - 16} r="3.3" onPointerDown={(event) => { event.stopPropagation(); dragMode.current = "rotate"; dragRegionId.current = selectedRegion.id; lastPoint.current = toCanvasPoint(event.clientX, event.clientY); }} /><rect className="resize-handle" x={selectedBox.x + selectedBox.width - 3} y={selectedBox.y + selectedBox.height - 3} width="6" height="6" onPointerDown={(event) => { event.stopPropagation(); dragMode.current = "resize"; dragRegionId.current = selectedRegion.id; lastPoint.current = toCanvasPoint(event.clientX, event.clientY); }} />{activeTool === "direct" ? selectedRegion.boundary.map((point, index) => <rect key={index} className="node-handle" x={point.x - 2.7} y={point.y - 2.7} width="5.4" height="5.4" onPointerDown={(event) => { event.stopPropagation(); dragMode.current = "node"; dragRegionId.current = selectedRegion.id; nodeIndex.current = index; }} />) : null}</g> : null}
        <rect width={project.canvas.width} height={project.canvas.height} fill="none" stroke="#4d514b" strokeWidth="1.1" />
        <g className="rulers" data-export-ignore>{Array.from({ length: Math.floor(project.canvas.width / 50) + 1 }, (_, index) => <g key={`x-${index}`}><line x1={index * 50} y1="-7" x2={index * 50} y2="0" /><text x={index * 50 + 2} y="-3">{index * 50}</text></g>)}{Array.from({ length: Math.floor(project.canvas.height / 50) + 1 }, (_, index) => <g key={`y-${index}`}><line x1="-7" y1={index * 50} x2="0" y2={index * 50} /><text x="-23" y={index * 50 + 3}>{index * 50}</text></g>)}</g>
      </g>
    </svg>
    <div className="canvas-coordinates">{cursor ? `${cursor.x.toFixed(0)}, ${cursor.y.toFixed(0)} mm` : "—"} · {adjacencies.length} 邻接</div>
  </div></div>;
}
