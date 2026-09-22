import { getPattern } from "../patterns/library";
import type { PatternDefinition, Point, RegionAdjacency, StripGeometry, StripMergeNode, StripSplitNode, TransitionZone, WeaveRegion } from "../types/weave";
import { centroid, distance } from "./geometry";

export interface TransitionResult { strips: StripGeometry[]; mergeNodes: StripMergeNode[]; splitNodes: StripSplitNode[]; band: Point[]; warnings: string[] }

function normalForBoundary(points: Point[]): Point {
  const [a, b] = points;
  const length = Math.max(1, distance(a, b));
  return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
}

export function patternSimilarity(a: PatternDefinition, b: PatternDefinition): number {
  const directionDelta = Math.abs(a.topology.dominantDirections.length - b.topology.dominantDirections.length) / 6;
  const opennessDelta = Math.abs(a.topology.openness - b.topology.openness);
  const angleDelta = Math.min(1, Math.abs(a.topology.averageAngle - b.topology.averageAngle) / 90);
  return Math.max(0, 1 - (directionDelta * .35 + opennessDelta * .35 + angleDelta * .3));
}

export function generateTransition(zone: TransitionZone, adjacency: RegionAdjacency, regionA: WeaveRegion, regionB: WeaveRegion, customPatterns: PatternDefinition[] = []): TransitionResult {
  const normal = normalForBoundary(adjacency.sharedBoundary);
  const tangent = { x: -normal.y, y: normal.x };
  const center = zone.controlPoints[1] ?? adjacency.center;
  const halfWidth = zone.width / 2;
  const halfLength = Math.max(adjacency.length, 45) / 2;
  const band = [
    { x: center.x - tangent.x * halfLength - normal.x * halfWidth, y: center.y - tangent.y * halfLength - normal.y * halfWidth },
    { x: center.x + tangent.x * halfLength - normal.x * halfWidth, y: center.y + tangent.y * halfLength - normal.y * halfWidth },
    { x: center.x + tangent.x * halfLength + normal.x * halfWidth, y: center.y + tangent.y * halfLength + normal.y * halfWidth },
    { x: center.x - tangent.x * halfLength + normal.x * halfWidth, y: center.y - tangent.y * halfLength + normal.y * halfWidth },
  ];
  const sourcePattern = getPattern(regionA.pattern.patternId, customPatterns);
  const targetPattern = getPattern(regionB.pattern.patternId, customPatterns);
  const similarity = patternSimilarity(sourcePattern, targetPattern);
  const startCount = Math.max(3, Math.round(halfLength * 2 / Math.max(4, regionA.pattern.stripWidth / (regionA.pattern.density / 100))));
  const endCount = Math.max(3, Math.round(halfLength * 2 / Math.max(4, regionB.pattern.stripWidth / (regionB.pattern.density / 100))));
  const pathCount = Math.min(48, Math.max(startCount, endCount));
  const strips: StripGeometry[] = [];
  for (let index = 0; index < pathCount; index += 1) {
    const startSlot = Math.min(startCount - 1, Math.round(index * (startCount - 1) / Math.max(1, pathCount - 1)));
    const endSlot = Math.min(endCount - 1, Math.round(index * (endCount - 1) / Math.max(1, pathCount - 1)));
    const startOffset = (startSlot / Math.max(1, startCount - 1) - .5) * halfLength * 2;
    const endOffset = (endSlot / Math.max(1, endCount - 1) - .5) * halfLength * 2;
    const start = { x: center.x + tangent.x * startOffset - normal.x * halfWidth, y: center.y + tangent.y * startOffset - normal.y * halfWidth };
    const end = { x: center.x + tangent.x * endOffset + normal.x * halfWidth, y: center.y + tangent.y * endOffset + normal.y * halfWidth };
    const curvature = (endOffset - startOffset) * zone.smoothness / 200;
    strips.push({
      id: `${zone.id}-continuous-${index}`, regionId: zone.id, directionAngle: sourcePattern.topology.averageAngle + (targetPattern.topology.averageAngle - sourcePattern.topology.averageAngle) * .5,
      directionIndex: index % Math.max(1, sourcePattern.structure.directions.length), index,
      path: [start, { x: center.x - tangent.x * curvature, y: center.y - tangent.y * curvature }, end],
      width: regionA.pattern.stripWidth + (regionB.pattern.stripWidth - regionA.pattern.stripWidth) * (index / Math.max(1, pathCount - 1)),
      color: index % 2 ? regionA.color : regionB.color,
      overUnderSequence: Array.from({ length: 24 }, (_, crossingIndex) => (crossingIndex + index) % 2 === 0),
    });
  }
  const mergeNodes: StripMergeNode[] = [];
  const splitNodes: StripSplitNode[] = [];
  const difference = startCount - endCount;
  for (let index = 0; index < Math.min(Math.abs(difference), 8); index += 1) {
    const position = { x: center.x + tangent.x * ((index + 1) / (Math.abs(difference) + 1) - .5) * halfLength, y: center.y + tangent.y * ((index + 1) / (Math.abs(difference) + 1) - .5) * halfLength };
    if (difference > 0) mergeNodes.push({ id: `${zone.id}-merge-${index}`, incomingStripIds: [`a-${index * 2}`, `a-${index * 2 + 1}`], outgoingStripId: `b-${index}`, position });
    else splitNodes.push({ id: `${zone.id}-split-${index}`, incomingStripId: `a-${index}`, outgoingStripIds: [`b-${index * 2}`, `b-${index * 2 + 1}`], position });
  }
  return { strips, mergeNodes, splitNodes, band, warnings: similarity < .35 ? ["拓扑差异较大，已使用简化 Bridge 结构。"] : [] };
}

export function makeTransition(adjacency: RegionAdjacency, index: number): TransitionZone {
  const centerA = adjacency.sharedBoundary[0]; const centerB = adjacency.sharedBoundary[1];
  return { id: `transition-${adjacency.regionA}-${adjacency.regionB}`, name: `过渡 ${index + 1}`, regionIds: [adjacency.regionA, adjacency.regionB], adjacencyId: adjacency.id, width: 40, mode: "structural", smoothness: 72, complexity: 55, controlPoints: [centerA, adjacency.center, centerB], enabled: true, visible: true, locked: false };
}
