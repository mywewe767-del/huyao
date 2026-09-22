"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { generateProjectWeave } from "@/engine/patternGenerator";
import { generateDensityTransition } from "@/engine/transition";
import { useStudioStore } from "@/store/useStudioStore";
import type { Point, StripGeometry } from "@/types/weave";

function clipLineToRect(a: Point, b: Point, xMin: number, yMin: number, xMax: number, yMax: number): [Point, Point] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let low = 0;
  let high = 1;
  const checks: [number, number][] = [[-dx, a.x - xMin], [dx, xMax - a.x], [-dy, a.y - yMin], [dy, yMax - a.y]];
  for (const [p, q] of checks) {
    if (p === 0 && q < 0) return null;
    if (p !== 0) {
      const ratio = q / p;
      if (p < 0) low = Math.max(low, ratio); else high = Math.min(high, ratio);
    }
  }
  if (low > high) return null;
  return [{ x: a.x + low * dx, y: a.y + low * dy }, { x: a.x + high * dx, y: a.y + high * dy }];
}

function StripMesh({ strip, segment, thickness, canvasWidth, canvasHeight, raised = false }: { strip: StripGeometry; segment: [Point, Point]; thickness: number; canvasWidth: number; canvasHeight: number; raised?: boolean }) {
  const [start, end] = segment;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const x = (start.x + end.x) / 2 - canvasWidth / 2;
  const y = canvasHeight / 2 - (start.y + end.y) / 2;
  return (
    <mesh position={[x, y, raised ? thickness * .72 : strip.direction === "warp" ? thickness * .12 : -thickness * .12]} rotation={[0, 0, -angle]} castShadow receiveShadow>
      <boxGeometry args={[length, strip.width, raised ? thickness * .78 : thickness * .56]} />
      <meshStandardMaterial color={strip.color} roughness={0.62} metalness={0.02} />
    </mesh>
  );
}

function WeaveScene() {
  const project = useStudioStore((state) => state.project);
  const weave = useMemo(() => generateProjectWeave(project.regions, project.appearance), [project.regions, project.appearance]);
  const transition = useMemo(() => generateDensityTransition(project.regions[0], project.regions[1], project.transition, project.appearance), [project.regions, project.transition, project.appearance]);
  const stripMap = useMemo(() => new Map(weave.strips.map((strip) => [strip.id, strip])), [weave.strips]);
  return (
    <group rotation={[-0.16, 0.08, 0]} scale={.023}>
      <mesh position={[0, 0, -project.appearance.thickness * .7]} receiveShadow>
        <boxGeometry args={[project.canvas.width + 5, project.canvas.height + 5, .8]} />
        <meshStandardMaterial color="#282824" roughness={1} />
      </mesh>
      {project.regions.flatMap((region) => {
        const xMin = region.boundary[0].x;
        const xMax = region.boundary[1].x;
        return weave.strips.filter((strip) => strip.regionId === region.id).map((strip) => {
          const segment = clipLineToRect(strip.path[0], strip.path.at(-1)!, xMin, 0, xMax, project.canvas.height);
          return segment ? <StripMesh key={strip.id} strip={strip} segment={segment} thickness={project.appearance.thickness} canvasWidth={project.canvas.width} canvasHeight={project.canvas.height} /> : null;
        });
      })}
      {project.transition.enabled ? transition.strips.map((strip) => {
        const segment = strip.path.length === 2
          ? clipLineToRect(strip.path[0], strip.path[1], 0, 0, project.canvas.width, project.canvas.height)
          : [strip.path[0], strip.path.at(-1)!] as [Point, Point];
        return segment ? <StripMesh key={`3d-${strip.id}`} strip={strip} segment={segment} thickness={project.appearance.thickness} canvasWidth={project.canvas.width} canvasHeight={project.canvas.height} raised={strip.direction === "weft"} /> : null;
      }) : null}
      {weave.crossings.map((crossing) => {
        const strip = stripMap.get(crossing.overStripId);
        if (!strip) return null;
        const radians = strip.angle * Math.PI / 180;
        const half = Math.max(strip.width * 1.25, 4);
        const segment: [Point, Point] = [
          { x: crossing.position.x - Math.cos(radians) * half, y: crossing.position.y - Math.sin(radians) * half },
          { x: crossing.position.x + Math.cos(radians) * half, y: crossing.position.y + Math.sin(radians) * half },
        ];
        return <StripMesh key={`bridge-${crossing.id}`} strip={strip} segment={segment} thickness={project.appearance.thickness} canvasWidth={project.canvas.width} canvasHeight={project.canvas.height} raised />;
      })}
    </group>
  );
}

export default function ThreePreview() {
  return (
    <div className="three-preview">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 0.4, 8.5], fov: 38 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={["#1d201e"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[4, 6, 8]} intensity={3.2} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-4, -2, 5]} intensity={1.2} color="#d9e6d7" />
        <WeaveScene />
      </Canvas>
      <div className="preview-caption"><span>REALISTIC PREVIEW</span><strong>实体条带 · 交叉抬升 · 粗糙材质</strong></div>
    </div>
  );
}
