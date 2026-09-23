import type { CutLineState, Point, StripGeometry } from "../types/weave";
import { intersectSegments } from "./geometry";

const EPSILON = .001;

export function sideOfLine(point: Point, start: Point, end: Point): number {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
}

function samePoint(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

/** Splits a polyline at every finite intersection with the cutter segment. */
export function splitPathAtLine(path: Point[], start: Point, end: Point): Point[][] {
  if (path.length < 2) return [];
  const result: Point[][] = []; let current: Point[] = [path[0]];
  for (let index = 0; index < path.length - 1; index += 1) {
    const a = path[index]; const b = path[index + 1]; const crossing = intersectSegments(a, b, start, end);
    if (crossing && !samePoint(crossing, a) && !samePoint(crossing, b)) {
      current.push(crossing); if (current.length > 1) result.push(current); current = [crossing, b];
    } else current.push(b);
  }
  if (current.length > 1) result.push(current);
  return result;
}

function segmentSide(path: Point[], cut: CutLineState) {
  const middle = path.reduce((sum, point) => ({ x: sum.x + point.x / path.length, y: sum.y + point.y / path.length }), { x: 0, y: 0 });
  return sideOfLine(middle, cut.start, cut.end);
}

export function cutPath(path: Point[], cut: CutLineState): Point[][] {
  const split = splitPathAtLine(path, cut.start, cut.end);
  if (split.length < 2) return [path];
  if (cut.mode === "split" || cut.mode === "keep-both") return split;
  const keepPositive = cut.mode === "keep-left" || cut.mode === "delete-right";
  return split.filter((segment) => keepPositive ? segmentSide(segment, cut) >= 0 : segmentSide(segment, cut) <= 0);
}

export function stripMatchesCutScope(strip: StripGeometry, cut: CutLineState, selectedStripIds: string[]) {
  if (cut.scope === "all") return true;
  if (cut.scope === "region") return strip.regionId === cut.regionId;
  if (cut.scope === "layer") return strip.regionId === cut.regionId && strip.directionLayerId === cut.directionLayerId;
  if (cut.scope === "direction") return cut.directionAngle !== undefined && Math.abs((((strip.directionAngle - cut.directionAngle) % 180) + 180) % 180) < .5;
  return selectedStripIds.includes(strip.id) || selectedStripIds.includes(strip.baseStripId);
}

export function pathIntersectsCut(path: Point[], cut: CutLineState) {
  return path.slice(0, -1).some((point, index) => intersectSegments(point, path[index + 1], cut.start, cut.end));
}
