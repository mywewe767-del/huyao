import { getPattern } from "../patterns/library";
import { generateRegionWeave } from "./patternGenerator";
import type { PatternDefinition, Point, RegionAdjacency, StripGeometry, StripMergeNode, StripSplitNode, TransitionStrategy, TransitionZone, WeaveRegion } from "../types/weave";
import { centroid, distance, intersectSegments } from "./geometry";

export interface BoundaryStripEndpoint {
  id: string;
  stripId: string;
  regionId: string;
  point: Point;
  tangent: Point;
  directionAngle: number;
  stripWidth: number;
  directionLayerId: string;
  boundaryT: number;
  color: string;
  materialId?: string;
}

export type TransitionConnectionType = "continue" | "merge" | "split" | "fade" | "insert";

export interface TransitionStrip extends StripGeometry {
  sourceStripIds: string[];
  targetStripIds: string[];
  type: TransitionConnectionType;
  inheritedWidth: number;
  inheritedMaterial?: string;
}

export interface EndpointMatch {
  id: string;
  sourceEndpointIds: string[];
  targetEndpointIds: string[];
  type: "continue" | "merge" | "split";
  cost: number;
}

export interface TransitionResult {
  strips: TransitionStrip[];
  mergeNodes: StripMergeNode[];
  splitNodes: StripSplitNode[];
  band: Point[];
  warnings: string[];
  stageCount: number;
  sourceEndpoints: BoundaryStripEndpoint[];
  targetEndpoints: BoundaryStripEndpoint[];
  matches: EndpointMatch[];
}

const TRANSITION_APPEARANCE = { globalColor: "#c9a96e", thickness: 1.2, stripOverrides: {} };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixPoint = (a: Point, b: Point, t: number): Point => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const normalize = (value: Point): Point => { const length = Math.max(.0001, Math.hypot(value.x, value.y)); return { x: value.x / length, y: value.y / length }; };
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const add = (point: Point, vector: Point, amount: number): Point => ({ x: point.x + vector.x * amount, y: point.y + vector.y * amount });

function boundaryMetrics(boundary: Point[]) {
  const lengths = boundary.slice(0, -1).map((point, index) => distance(point, boundary[index + 1]));
  return { lengths, total: Math.max(.0001, lengths.reduce((sum, length) => sum + length, 0)) };
}

export function extractBoundaryEndpoints(region: WeaveRegion, adjacency: RegionAdjacency, towardRegion: WeaveRegion, customPatterns: PatternDefinition[] = []): BoundaryStripEndpoint[] {
  const generated = generateRegionWeave(region, TRANSITION_APPEARANCE, customPatterns);
  const boundary = adjacency.sharedBoundary; const metrics = boundaryMetrics(boundary); const toward = normalize({ x: centroid(towardRegion.boundary).x - centroid(region.boundary).x, y: centroid(towardRegion.boundary).y - centroid(region.boundary).y });
  const endpoints: BoundaryStripEndpoint[] = [];
  generated.strips.forEach((strip) => {
    for (let stripIndex = 0; stripIndex < strip.path.length - 1; stripIndex += 1) {
      const start = strip.path[stripIndex]; const end = strip.path[stripIndex + 1];
      for (let boundaryIndex = 0; boundaryIndex < boundary.length - 1; boundaryIndex += 1) {
        const point = intersectSegments(start, end, boundary[boundaryIndex], boundary[boundaryIndex + 1]); if (!point) continue;
        let tangent = normalize({ x: end.x - start.x, y: end.y - start.y }); if (dot(tangent, toward) < 0) tangent = { x: -tangent.x, y: -tangent.y };
        const elapsed = metrics.lengths.slice(0, boundaryIndex).reduce((sum, length) => sum + length, 0); const segmentLength = Math.max(.0001, metrics.lengths[boundaryIndex]);
        const localT = distance(boundary[boundaryIndex], point) / segmentLength; const layer = region.pattern.directionLayers[strip.directionIndex];
        endpoints.push({ id: `${region.id}:${strip.id}:boundary`, stripId: strip.id, regionId: region.id, point, tangent, directionAngle: strip.directionAngle, stripWidth: strip.width, directionLayerId: layer?.id ?? `direction-${strip.directionIndex}`, boundaryT: clamp((elapsed + localT * segmentLength) / metrics.total, 0, 1), color: strip.color, materialId: region.materialId });
        return;
      }
    }
  });
  return endpoints.toSorted((a, b) => a.boundaryT - b.boundaryT || a.directionAngle - b.directionAngle);
}

function endpointCost(a: BoundaryStripEndpoint, b: BoundaryStripEndpoint): number {
  const position = Math.abs(a.boundaryT - b.boundaryT);
  const angle = Math.acos(clamp(dot(a.tangent, b.tangent), -1, 1)) / Math.PI;
  const width = Math.abs(a.stripWidth - b.stripWidth) / Math.max(1, a.stripWidth, b.stripWidth);
  const direction = Math.min(1, Math.abs(a.directionAngle - b.directionAngle) % 180 / 90);
  return position * 5 + angle * 2.25 + width * 1.2 + direction * .9;
}

function groupCost(a: BoundaryStripEndpoint[], b: BoundaryStripEndpoint[], complexity: number): number {
  let cost = 0; for (const source of a) for (const target of b) cost += endpointCost(source, target);
  return cost / Math.max(1, a.length * b.length) + Math.abs(a.length - b.length) * lerp(1.2, .35, complexity / 100);
}

export function matchBoundaryEndpoints(source: BoundaryStripEndpoint[], target: BoundaryStripEndpoint[], complexity = 50): EndpointMatch[] {
  if (!source.length || !target.length) return [];
  const rows = source.length + 1; const cols = target.length + 1; const dp = Array.from({ length: rows }, () => Array(cols).fill(Number.POSITIVE_INFINITY));
  const previous = Array.from({ length: rows }, () => Array<{ i: number; j: number; ga: number; gb: number } | null>(cols).fill(null)); dp[0][0] = 0;
  const maxSourceGroup = Math.min(12, Math.max(2, Math.ceil(source.length / target.length) + 2)); const maxTargetGroup = Math.min(12, Math.max(2, Math.ceil(target.length / source.length) + 2));
  for (let i = 0; i < rows; i += 1) for (let j = 0; j < cols; j += 1) {
    if (!Number.isFinite(dp[i][j])) continue;
    const candidates: [number, number][] = [[1, 1]];
    for (let size = 2; size <= maxSourceGroup; size += 1) candidates.push([size, 1]);
    for (let size = 2; size <= maxTargetGroup; size += 1) candidates.push([1, size]);
    for (const [ga, gb] of candidates) {
      if (i + ga > source.length || j + gb > target.length) continue;
      const cost = dp[i][j] + groupCost(source.slice(i, i + ga), target.slice(j, j + gb), complexity);
      if (cost < dp[i + ga][j + gb]) { dp[i + ga][j + gb] = cost; previous[i + ga][j + gb] = { i, j, ga, gb }; }
    }
  }
  if (!Number.isFinite(dp[source.length][target.length])) return [];
  const matches: EndpointMatch[] = []; let i = source.length; let j = target.length;
  while (i || j) { const step = previous[i][j]; if (!step) return []; const sources = source.slice(step.i, i); const targets = target.slice(step.j, j); matches.push({ id: `match-${step.i}-${step.j}`, sourceEndpointIds: sources.map((item) => item.id), targetEndpointIds: targets.map((item) => item.id), type: sources.length > 1 ? "merge" : targets.length > 1 ? "split" : "continue", cost: groupCost(sources, targets, complexity) }); i = step.i; j = step.j; }
  return matches.reverse();
}

function cubicBezier(start: Point, startTangent: Point, end: Point, endTangent: Point, handleDistance: number, stages: number, bend = 0): Point[] {
  const chord = normalize({ x: end.x - start.x, y: end.y - start.y }); const normal = { x: -chord.y, y: chord.x };
  const c1 = add(add(start, startTangent, handleDistance), normal, bend); const c2 = add(add(end, endTangent, -handleDistance), normal, bend);
  return Array.from({ length: stages }, (_, index) => { const t = index / Math.max(1, stages - 1); const u = 1 - t; return { x: u ** 3 * start.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * end.x, y: u ** 3 * start.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * end.y }; });
}

function transitionBend(zone: TransitionZone, index: number, count: number): number {
  const centered = count <= 1 ? 0 : index / (count - 1) - .5;
  if (zone.strategy === "fan-out") return centered * zone.fanStrength * .16;
  if (zone.strategy === "bridge-pattern") return Math.sin((index + 1) * 1.7) * zone.complexity * .025;
  if (zone.strategy === "pattern-morph" || zone.mode === "decorative") return Math.sin((index + 1) * 1.3) * zone.complexity * .018;
  if (zone.mode === "experimental") return centered * zone.complexity * .06;
  return 0;
}

function makeStrip(id: string, type: TransitionConnectionType, sources: BoundaryStripEndpoint[], targets: BoundaryStripEndpoint[], path: Point[], width: number, color: string, directionAngle: number, index: number): TransitionStrip {
  return { id, regionId: id.split("-segment-")[0], directionAngle, directionIndex: index, index, path, width, color, overUnderSequence: Array.from({ length: path.length }, (_, crossing) => crossing % 2 === 0), sourceStripIds: sources.map((item) => item.stripId), targetStripIds: targets.map((item) => item.stripId), type, inheritedWidth: width, inheritedMaterial: sources[0]?.materialId ?? targets[0]?.materialId };
}

function validateConnectivity(strips: TransitionStrip[], source: BoundaryStripEndpoint[], target: BoundaryStripEndpoint[]): string[] {
  const sourceIds = new Set(source.map((item) => item.stripId)); const targetIds = new Set(target.map((item) => item.stripId)); const warnings: string[] = [];
  for (const strip of strips) {
    const hasSource = strip.sourceStripIds.some((id) => sourceIds.has(id)); const hasTarget = strip.targetStripIds.some((id) => targetIds.has(id));
    if (!hasSource && !hasTarget) warnings.push(`FREE_FLOATING_TRANSITION_STRIP:${strip.id}`);
    if (!strip.path.length || !strip.sourceStripIds.length || !strip.targetStripIds.length) warnings.push(`INVALID_TRANSITION_CONNECTIVITY:${strip.id}`);
  }
  return warnings;
}

export function patternSimilarity(a: PatternDefinition, b: PatternDefinition): number {
  const directionDelta = Math.abs(a.topology.dominantDirections.length - b.topology.dominantDirections.length) / 6; const opennessDelta = Math.abs(a.topology.openness - b.topology.openness);
  const angleDelta = a.topology.dominantDirections.reduce((sum, angle) => sum + Math.min(...b.topology.dominantDirections.map((other) => Math.abs(angle - other) % 180)), 0) / Math.max(1, a.topology.dominantDirections.length * 90);
  return Math.max(0, 1 - (directionDelta * .3 + opennessDelta * .35 + Math.min(1, angleDelta) * .35));
}

export function recommendedStrategy(a: PatternDefinition, b: PatternDefinition): TransitionStrategy { const similarity = patternSimilarity(a, b); return similarity > .72 ? "pattern-morph" : similarity > .42 ? "direction-rotation" : "bridge-pattern"; }

export function generateTransition(zone: TransitionZone, adjacency: RegionAdjacency, regionA: WeaveRegion, regionB: WeaveRegion, customPatterns: PatternDefinition[] = []): TransitionResult {
  const sourceEndpoints = extractBoundaryEndpoints(regionA, adjacency, regionB, customPatterns); const targetEndpoints = extractBoundaryEndpoints(regionB, adjacency, regionA, customPatterns).map((endpoint) => ({ ...endpoint, tangent: { x: -endpoint.tangent.x, y: -endpoint.tangent.y } }));
  const matches = matchBoundaryEndpoints(sourceEndpoints, targetEndpoints, zone.complexity); const sourceMap = new Map(sourceEndpoints.map((item) => [item.id, item])); const targetMap = new Map(targetEndpoints.map((item) => [item.id, item]));
  const boundaryStart = adjacency.sharedBoundary[0]; const boundaryEnd = adjacency.sharedBoundary.at(-1)!; const boundaryDirection = normalize({ x: boundaryEnd.x - boundaryStart.x, y: boundaryEnd.y - boundaryStart.y }); const boundaryNormal = { x: -boundaryDirection.y, y: boundaryDirection.x };
  const center = zone.controlPoints[1] ?? adjacency.center; const halfWidth = zone.width / 2; const halfLength = Math.max(adjacency.length, 1) / 2;
  const band = [{ x: center.x - boundaryDirection.x * halfLength - boundaryNormal.x * halfWidth, y: center.y - boundaryDirection.y * halfLength - boundaryNormal.y * halfWidth }, { x: center.x + boundaryDirection.x * halfLength - boundaryNormal.x * halfWidth, y: center.y + boundaryDirection.y * halfLength - boundaryNormal.y * halfWidth }, { x: center.x + boundaryDirection.x * halfLength + boundaryNormal.x * halfWidth, y: center.y + boundaryDirection.y * halfLength + boundaryNormal.y * halfWidth }, { x: center.x - boundaryDirection.x * halfLength + boundaryNormal.x * halfWidth, y: center.y - boundaryDirection.y * halfLength + boundaryNormal.y * halfWidth }];
  const stages = clamp(Math.round(zone.stageCount || 12), 6, 32); const handleFactor = lerp(.12, .44, zone.smoothness / 100); const strips: TransitionStrip[] = []; const mergeNodes: StripMergeNode[] = []; const splitNodes: StripSplitNode[] = [];
  matches.forEach((match, matchIndex) => {
    const sources = match.sourceEndpointIds.map((id) => sourceMap.get(id)!).filter(Boolean); const targets = match.targetEndpointIds.map((id) => targetMap.get(id)!).filter(Boolean); const bend = transitionBend(zone, matchIndex, matches.length);
    const sourceStarts = sources.map((endpoint) => add(endpoint.point, endpoint.tangent, -halfWidth)); const targetEnds = targets.map((endpoint) => add(endpoint.point, endpoint.tangent, halfWidth));
    if (match.type === "continue") {
      const start = sourceStarts[0]; const end = targetEnds[0]; const handle = Math.min(distance(start, end) * .46, zone.width * handleFactor);
      strips.push(makeStrip(`${zone.id}-segment-${matchIndex}`, "continue", sources, targets, cubicBezier(start, sources[0].tangent, end, targets[0].tangent, handle, stages, bend), lerp(sources[0].stripWidth, targets[0].stripWidth, .5), sources[0].color, lerp(sources[0].directionAngle, targets[0].directionAngle, .5), matchIndex)); return;
    }
    if (match.type === "merge") {
      const target = targets[0]; const end = targetEnds[0]; const averageStart = sourceStarts.reduce((sum, point) => ({ x: sum.x + point.x / sourceStarts.length, y: sum.y + point.y / sourceStarts.length }), { x: 0, y: 0 }); const nodePoint = mixPoint(averageStart, end, .58);
      const incomingIds: string[] = [];
      sources.forEach((source, branchIndex) => { const start = sourceStarts[branchIndex]; const id = `${zone.id}-segment-${matchIndex}-merge-in-${branchIndex}`; const handle = Math.min(distance(start, nodePoint) * .42, zone.width * handleFactor); incomingIds.push(id); strips.push(makeStrip(id, "merge", [source], [target], cubicBezier(start, source.tangent, nodePoint, target.tangent, handle, Math.max(4, Math.ceil(stages * .6)), bend), source.stripWidth, source.color, source.directionAngle, strips.length)); });
      const outgoingId = `${zone.id}-segment-${matchIndex}-merge-out`; const handle = Math.min(distance(nodePoint, end) * .42, zone.width * handleFactor); strips.push(makeStrip(outgoingId, "merge", sources, [target], cubicBezier(nodePoint, target.tangent, end, target.tangent, handle, Math.max(4, Math.ceil(stages * .5))), target.stripWidth, target.color, target.directionAngle, strips.length)); mergeNodes.push({ id: `${zone.id}-merge-${matchIndex}`, incomingStripIds: incomingIds, outgoingStripId: outgoingId, position: nodePoint }); return;
    }
    const source = sources[0]; const start = sourceStarts[0]; const averageEnd = targetEnds.reduce((sum, point) => ({ x: sum.x + point.x / targetEnds.length, y: sum.y + point.y / targetEnds.length }), { x: 0, y: 0 }); const nodePoint = mixPoint(start, averageEnd, .42); const incomingId = `${zone.id}-segment-${matchIndex}-split-in`; const incomingHandle = Math.min(distance(start, nodePoint) * .42, zone.width * handleFactor);
    strips.push(makeStrip(incomingId, "split", [source], targets, cubicBezier(start, source.tangent, nodePoint, source.tangent, incomingHandle, Math.max(4, Math.ceil(stages * .5))), source.stripWidth, source.color, source.directionAngle, strips.length)); const outgoingIds: string[] = [];
    targets.forEach((target, branchIndex) => { const end = targetEnds[branchIndex]; const id = `${zone.id}-segment-${matchIndex}-split-out-${branchIndex}`; const handle = Math.min(distance(nodePoint, end) * .42, zone.width * handleFactor); outgoingIds.push(id); strips.push(makeStrip(id, "split", [source], [target], cubicBezier(nodePoint, source.tangent, end, target.tangent, handle, Math.max(4, Math.ceil(stages * .6)), bend), target.stripWidth, target.color, target.directionAngle, strips.length)); }); splitNodes.push({ id: `${zone.id}-split-${matchIndex}`, incomingStripId: incomingId, outgoingStripIds: outgoingIds, position: nodePoint });
  });
  const warnings: string[] = []; if (!sourceEndpoints.length) warnings.push("NO_SOURCE_BOUNDARY_STRIPS"); if (!targetEndpoints.length) warnings.push("NO_TARGET_BOUNDARY_STRIPS"); if (!matches.length && sourceEndpoints.length && targetEndpoints.length) warnings.push("BOUNDARY_MATCHING_FAILED"); warnings.push(...validateConnectivity(strips, sourceEndpoints, targetEndpoints));
  return { strips: strips.filter((strip) => !warnings.includes(`FREE_FLOATING_TRANSITION_STRIP:${strip.id}`)), mergeNodes, splitNodes, band, warnings, stageCount: stages, sourceEndpoints, targetEndpoints, matches };
}

export function makeTransition(adjacency: RegionAdjacency, index: number): TransitionZone {
  return { id: `transition-${adjacency.regionA}-${adjacency.regionB}`, name: `过渡 ${index + 1}`, regionIds: [adjacency.regionA, adjacency.regionB], adjacencyId: adjacency.id, width: 40, mode: "structural", strategy: "spacing-gradient", smoothness: 72, complexity: 55, stageCount: 12, bridgePatternIds: [], regenerationSeed: 0, fanStrength: 45, spreadAngle: 35, curves: [], controlPoints: [adjacency.sharedBoundary[0], adjacency.center, adjacency.sharedBoundary.at(-1)!], enabled: true, visible: true, locked: false };
}
