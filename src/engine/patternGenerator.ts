import { getPattern } from "../patterns/library";
import type { AppearanceSettings, Crossing, GeneratedWeave, PatternRegion, Point, StripGeometry } from "../types/weave";
import { bounds, intersectSegments, rotatePoint } from "./geometry";

function lineForAngle(angle: number, offset: number, box: ReturnType<typeof bounds>): Point[] {
  const diagonal = Math.hypot(box.width, box.height) * 1.6;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const base: Point[] = [
    { x: center.x - diagonal, y: center.y + offset },
    { x: center.x + diagonal, y: center.y + offset },
  ];
  return base.map((point) => rotatePoint(point, center, angle));
}

function sequence(rule: string, stripIndex: number, count: number): boolean[] {
  return Array.from({ length: count }, (_, crossingIndex) => {
    if (rule === "twill-3") return (stripIndex + crossingIndex) % 3 !== 2;
    if (rule === "herringbone") return (Math.floor(stripIndex / 3) + crossingIndex) % 2 === 0;
    return (stripIndex + crossingIndex) % 2 === 0;
  });
}

export function spacingForDensity(density: number, stripWidth: number): number {
  const safeDensity = Math.max(20, Math.min(95, density));
  return stripWidth / (safeDensity / 100);
}

export function generateRegionWeave(region: PatternRegion, appearance: AppearanceSettings): GeneratedWeave {
  const pattern = getPattern(region.patternId);
  const box = bounds(region.boundary);
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const strips: StripGeometry[] = [];
  pattern.structure.directions.forEach((baseAngle, directionIndex) => {
    const direction = directionIndex === 0 ? "warp" : directionIndex === 1 ? "weft" : "custom";
    const baseWidth = direction === "warp" ? region.warpWidth : region.weftWidth;
    const width = baseWidth;
    const spacing = spacingForDensity(region.density, baseWidth) * (pattern.structure.kind === "hexagonal" ? 1.35 : 1);
    const span = Math.hypot(box.width, box.height);
    const count = Math.ceil(span / spacing) + 2;
    for (let index = -Math.ceil(count / 2); index <= Math.ceil(count / 2); index += 1) {
      const id = `${region.id}-${direction}-${directionIndex}-${index + count}`;
      const override = appearance.stripOverrides[id];
      const color = override?.color ?? (direction === "warp" ? region.warpColor ?? appearance.warpColor : region.weftColor ?? appearance.weftColor);
      const stripAngle = baseAngle + region.rotation;
      strips.push({
        id, regionId: region.id, direction, path: lineForAngle(stripAngle, index * spacing, box).map((point) => rotatePoint(point, center, 0)),
        width: override?.width ?? width, color, angle: stripAngle, index: index + count,
        overUnderSequence: sequence(pattern.structure.overRule, index + count, count * 3),
      });
    }
  });
  const crossings: Crossing[] = [];
  for (let a = 0; a < strips.length; a += 1) {
    for (let b = a + 1; b < strips.length; b += 1) {
      if (strips[a].direction === strips[b].direction) continue;
      const point = intersectSegments(strips[a].path[0], strips[a].path[1], strips[b].path[0], strips[b].path[1]);
      if (!point || point.x < box.x || point.x > box.x + box.width || point.y < box.y || point.y > box.y + box.height) continue;
      const overA = (strips[a].index + strips[b].index) % 2 === 0;
      crossings.push({ id: `${strips[a].id}:${strips[b].id}`, stripA: strips[a].id, stripB: strips[b].id, position: point, overStripId: overA ? strips[a].id : strips[b].id });
    }
  }
  return { strips, crossings };
}

export function generateProjectWeave(regions: PatternRegion[], appearance: AppearanceSettings): GeneratedWeave {
  return regions.reduce<GeneratedWeave>((all, region) => {
    const generated = generateRegionWeave(region, appearance);
    all.strips.push(...generated.strips);
    all.crossings.push(...generated.crossings);
    return all;
  }, { strips: [], crossings: [] });
}
