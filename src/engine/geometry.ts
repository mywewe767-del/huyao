import type { Point } from "../types/weave";

export function bounds(points: Point[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

export function centroid(points: Point[]): Point {
  return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
}

export function rotatePoint(point: Point, center: Point, degrees: number): Point {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

export function intersectSegments(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const denominator = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(denominator) < 0.0001) return null;
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / denominator;
  const u = -((a1.x - a2.x) * (a1.y - b1.y) - (a1.y - a2.y) * (a1.x - b1.x)) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y)) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y || .00001) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function snapPoint(point: Point, size: number): Point { return { x: Math.round(point.x / size) * size, y: Math.round(point.y / size) * size }; }

export function translatePoints(points: Point[], dx: number, dy: number): Point[] { return points.map((point) => ({ x: point.x + dx, y: point.y + dy })); }

export function scalePoints(points: Point[], origin: Point, sx: number, sy: number): Point[] {
  return points.map((point) => ({ x: origin.x + (point.x - origin.x) * sx, y: origin.y + (point.y - origin.y) * sy }));
}

export function simplifyPath(points: Point[], tolerance = 2): Point[] {
  if (points.length < 4) return points;
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) if (distance(points[index], result.at(-1)!) >= tolerance) result.push(points[index]);
  result.push(points.at(-1)!);
  return result;
}
