"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import * as THREE from "three";
import { detectAdjacencies } from "@/engine/adjacency";
import { bounds } from "@/engine/geometry";
import { generateDocumentWeave } from "@/engine/patternGenerator";
import { generateTransition } from "@/engine/transition";
import { useStudioStore } from "@/store/useStudioStore";
import type { Point, StripGeometry } from "@/types/weave";

function clipLine(a: Point, b: Point, xMin: number, yMin: number, xMax: number, yMax: number): [Point, Point] | null {
  const dx = b.x - a.x; const dy = b.y - a.y; let low = 0; let high = 1;
  for (const [p, q] of [[-dx, a.x - xMin], [dx, xMax - a.x], [-dy, a.y - yMin], [dy, yMax - a.y]] as [number, number][]) {
    if (p === 0 && q < 0) return null; if (p !== 0) { const ratio = q / p; if (p < 0) low = Math.max(low, ratio); else high = Math.min(high, ratio); }
  }
  return low > high ? null : [{ x: a.x + low * dx, y: a.y + low * dy }, { x: a.x + high * dx, y: a.y + high * dy }];
}

function SegmentMesh({ strip, start, end, thickness, width, height, z = 0 }: { strip: StripGeometry; start: Point; end: Point; thickness: number; width: number; height: number; z?: number }) {
  const length = Math.hypot(end.x - start.x, end.y - start.y); const angle = Math.atan2(end.y - start.y, end.x - start.x);
  return <mesh position={[(start.x + end.x) / 2 - width / 2, height / 2 - (start.y + end.y) / 2, z]} rotation={[0, 0, -angle]} castShadow receiveShadow><boxGeometry args={[length, strip.width, thickness]} /><meshStandardMaterial color={strip.color} roughness={.61} metalness={.015} /></mesh>;
}

function StripMeshes({ strip, thickness, width, height, z }: { strip: StripGeometry; thickness: number; width: number; height: number; z: number }) {
  return <>{strip.path.slice(0, -1).map((point, index) => <SegmentMesh key={index} strip={strip} start={point} end={strip.path[index + 1]} thickness={thickness} width={width} height={height} z={z} />)}</>;
}

function WeaveScene({ exploded }: { exploded: boolean }) {
  const project = useStudioStore((state) => state.project);
  const weave = useMemo(() => generateDocumentWeave(project.regions, project.appearance, project.customPatterns), [project.regions, project.appearance, project.customPatterns]);
  const transitions = useMemo(() => {
    const adjacencyMap = new Map(detectAdjacencies(project.regions).map((item) => [item.id, item])); const regionMap = new Map(project.regions.map((item) => [item.id, item]));
    return project.transitions.flatMap((zone) => { const adjacency = adjacencyMap.get(zone.adjacencyId); const a = regionMap.get(zone.regionIds[0]); const b = regionMap.get(zone.regionIds[1]); return adjacency && a && b && zone.enabled && zone.visible ? generateTransition(zone, adjacency, a, b, project.customPatterns).strips : []; });
  }, [project.regions, project.transitions, project.customPatterns]);
  const stripMap = useMemo(() => new Map(weave.strips.map((strip) => [strip.id, strip])), [weave.strips]);
  return <group rotation={[-.16, .08, 0]} scale={.017}>
    <mesh position={[0, 0, -project.appearance.thickness]} receiveShadow><boxGeometry args={[project.canvas.width + 5, project.canvas.height + 5, .8]} /><meshStandardMaterial color="#242823" roughness={1} /></mesh>
    {project.regions.toSorted((a, b) => a.order - b.order).flatMap((region) => { const box = bounds(region.boundary); return weave.strips.filter((strip) => strip.regionId === region.id).map((strip) => { const clipped = clipLine(strip.path[0], strip.path.at(-1)!, box.x, box.y, box.x + box.width, box.y + box.height); return clipped ? <SegmentMesh key={strip.id} strip={strip} start={clipped[0]} end={clipped[1]} thickness={project.appearance.thickness * .55} width={project.canvas.width} height={project.canvas.height} z={region.order * .025 + strip.zOffset + (strip.directionIndex % 2 ? -.08 : .08) + (exploded ? strip.directionIndex * 6 : 0)} /> : null; }); })}
    {weave.crossings.map((crossing) => { const strip = stripMap.get(crossing.overStripId); if (!strip) return null; const radians = strip.directionAngle * Math.PI / 180; const half = Math.max(strip.width * 1.25, 4); return <SegmentMesh key={crossing.id} strip={strip} start={{ x: crossing.position.x - Math.cos(radians) * half, y: crossing.position.y - Math.sin(radians) * half }} end={{ x: crossing.position.x + Math.cos(radians) * half, y: crossing.position.y + Math.sin(radians) * half }} thickness={project.appearance.thickness * .78} width={project.canvas.width} height={project.canvas.height} z={strip.zOffset + project.appearance.thickness * .72 + (exploded ? strip.directionIndex * 6 : 0)} />; })}
    {transitions.map((strip) => <StripMeshes key={strip.id} strip={strip} thickness={project.appearance.thickness * .68} width={project.canvas.width} height={project.canvas.height} z={project.appearance.thickness * .45} />)}
  </group>;
}

export default function ThreePreview() {
  const [exploded, setExploded] = useState(false);
  return <div className="three-preview"><Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, .4, 8.5], fov: 38 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}><color attach="background" args={["#1d201e"]} /><ambientLight intensity={1.5} /><directionalLight position={[4, 6, 8]} intensity={3.2} castShadow /><directionalLight position={[-4, -2, 5]} intensity={1.1} color="#d9e6d7" /><WeaveScene exploded={exploded} /></Canvas><button className={`exploded-toggle ${exploded ? "active" : ""}`} onClick={() => setExploded((value) => !value)}>{exploded ? "合并视图" : "爆炸视图"}</button><div className="preview-caption"><span>REALISTIC PREVIEW · V4</span><strong>方向层 Z 高度 · 切割结构 · Over / Under</strong></div></div>;
}
