import type { Point, RegionAdjacency, WeaveRegion } from "../types/weave";
import { bounds, centroid, distance, intersectSegments, pointInPolygon } from "./geometry";

function closestBoundary(a: WeaveRegion, b: WeaveRegion): [Point, Point, number] {
  let best: [Point, Point, number] = [a.boundary[0], b.boundary[0], Number.POSITIVE_INFINITY];
  for (const pointA of a.boundary) for (const pointB of b.boundary) {
    const d = distance(pointA, pointB);
    if (d < best[2]) best = [pointA, pointB, d];
  }
  return best;
}

function pointOnSegment(point: Point, a: Point, b: Point): boolean {
  return Math.abs(distance(a, point) + distance(point, b) - distance(a, b)) < .15;
}

function collinearContacts(a1: Point, a2: Point, b1: Point, b2: Point): Point[] {
  const crossA = (a2.x - a1.x) * (b1.y - a1.y) - (a2.y - a1.y) * (b1.x - a1.x);
  const crossB = (a2.x - a1.x) * (b2.y - a1.y) - (a2.y - a1.y) * (b2.x - a1.x);
  if (Math.abs(crossA) > .15 || Math.abs(crossB) > .15) return [];
  return [a1, a2, b1, b2].filter((point) => pointOnSegment(point, a1, a2) && pointOnSegment(point, b1, b2));
}

function furthestPair(values: Point[]): Point[] {
  let pair: Point[] = values.slice(0, 2); let best = pair.length === 2 ? distance(pair[0], pair[1]) : 0;
  for (let i = 0; i < values.length; i += 1) for (let j = i + 1; j < values.length; j += 1) { const current = distance(values[i], values[j]); if (current > best) { best = current; pair = [values[i], values[j]]; } }
  return pair;
}

export function detectAdjacencies(regions: WeaveRegion[], tolerance = 8): RegionAdjacency[] {
  const active = regions.filter((region) => region.visible && region.id !== "background");
  const result: RegionAdjacency[] = [];
  for (let aIndex = 0; aIndex < active.length; aIndex += 1) for (let bIndex = aIndex + 1; bIndex < active.length; bIndex += 1) {
    const a = active[aIndex]; const b = active[bIndex];
    const boxA = bounds(a.boundary); const boxB = bounds(b.boundary);
    const boxesNear = boxA.x <= boxB.x + boxB.width + tolerance && boxA.x + boxA.width + tolerance >= boxB.x && boxA.y <= boxB.y + boxB.height + tolerance && boxA.y + boxA.height + tolerance >= boxB.y;
    if (!boxesNear) continue;
    const intersections: Point[] = []; const contacts: Point[] = [];
    for (let i = 0; i < a.boundary.length; i += 1) for (let j = 0; j < b.boundary.length; j += 1) {
      const a1 = a.boundary[i]; const a2 = a.boundary[(i + 1) % a.boundary.length]; const b1 = b.boundary[j]; const b2 = b.boundary[(j + 1) % b.boundary.length];
      const point = intersectSegments(a1, a2, b1, b2);
      if (point) intersections.push(point);
      contacts.push(...collinearContacts(a1, a2, b1, b2));
    }
    const [nearA, nearB, gap] = closestBoundary(a, b);
    const overlapping = pointInPolygon(centroid(a.boundary), b.boundary) || pointInPolygon(centroid(b.boundary), a.boundary);
    const boundaryPoints = [...contacts, ...intersections].filter((point, index, all) => all.findIndex((other) => distance(point, other) < .1) === index);
    if (!boundaryPoints.length && gap > tolerance && !overlapping) continue;
    const shared = boundaryPoints.length >= 2 ? furthestPair(boundaryPoints) : [nearA, nearB];
    const center = { x: (shared[0].x + shared[1].x) / 2, y: (shared[0].y + shared[1].y) / 2 };
    result.push({ id: `adj-${a.id}-${b.id}`, regionA: a.id, regionB: b.id, sharedBoundary: shared, center, length: Math.max(distance(shared[0], shared[1]), tolerance) });
  }
  return result;
}
