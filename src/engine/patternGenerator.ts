import { getPattern } from "../patterns/library";
import type { AppearanceSettings, Crossing, GeneratedWeave, PatternDefinition, Point, StripGeometry, WeaveRegion } from "../types/weave";
import { bounds, intersectSegments, rotatePoint } from "./geometry";

const palette = ["#d3b374", "#88a06e", "#b68a55", "#6f8b79", "#d6c28f", "#9c7552"];

function lineForAngle(angle: number, offset: number, box: ReturnType<typeof bounds>): Point[] {
  const diagonal = Math.hypot(box.width, box.height) * 1.7;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return [{ x: center.x - diagonal, y: center.y + offset }, { x: center.x + diagonal, y: center.y + offset }].map((point) => rotatePoint(point, center, angle));
}

function sequence(rule: PatternDefinition["structure"]["overRule"], stripIndex: number, count: number): boolean[] {
  return Array.from({ length: count }, (_, crossingIndex) => {
    if (rule === "twill-3") return (stripIndex + crossingIndex) % 3 !== 2;
    if (rule === "twill-4") return (stripIndex + crossingIndex) % 4 < 2;
    if (rule === "basket") return (Math.floor(stripIndex / 2) + Math.floor(crossingIndex / 2)) % 2 === 0;
    if (rule === "herringbone") return (Math.floor(stripIndex / 3) + crossingIndex) % 2 === 0;
    if (rule === "radial") return (stripIndex * 2 + crossingIndex) % 3 !== 0;
    return (stripIndex + crossingIndex) % 2 === 0;
  });
}

export function spacingForDensity(density: number, stripWidth: number): number {
  return stripWidth / (Math.max(20, Math.min(95, density)) / 100);
}

export function generateRegionWeave(region: WeaveRegion, appearance: AppearanceSettings, customPatterns: PatternDefinition[] = []): GeneratedWeave {
  if (!region.visible) return { strips: [], crossings: [] };
  const pattern = getPattern(region.pattern.patternId, customPatterns);
  const box = bounds(region.boundary);
  const strips: StripGeometry[] = [];
  pattern.structure.directions.forEach((baseAngle, directionIndex) => {
    const key = String(directionIndex);
    const baseWidth = region.pattern.directionWidths[key] ?? region.pattern.stripWidth;
    const width = Math.max(.8, baseWidth);
    const spacingFactor = pattern.structure.directionSpacing?.[directionIndex] ?? 1;
    const spacing = spacingForDensity(region.pattern.density, width) * spacingFactor / region.pattern.scale;
    const span = Math.hypot(box.width, box.height);
    const count = Math.min(180, Math.ceil(span / spacing) + 3);
    const phase = (pattern.structure.phaseOffsets?.[directionIndex] ?? 0) * spacing;
    for (let index = -Math.ceil(count / 2); index <= Math.ceil(count / 2); index += 1) {
      const id = `${region.id}-d${directionIndex}-s${index + count}`;
      const override = region.pattern.localOverrides[id] ?? appearance.stripOverrides[id];
      strips.push({
        id, regionId: region.id, directionAngle: baseAngle + region.pattern.rotation, directionIndex,
        path: lineForAngle(baseAngle + region.pattern.rotation, index * spacing + phase, box),
        width: override?.width ?? width,
        color: override?.color ?? region.pattern.directionColors[key] ?? (region.id === "background" ? appearance.globalColor : palette[directionIndex % palette.length] ?? region.color),
        index: index + count, overUnderSequence: sequence(pattern.structure.overRule, index + count, count * 4),
      });
    }
  });
  const crossings: Crossing[] = [];
  for (let a = 0; a < strips.length; a += 1) for (let b = a + 1; b < strips.length; b += 1) {
    if (strips[a].directionIndex === strips[b].directionIndex) continue;
    const point = intersectSegments(strips[a].path[0], strips[a].path[1], strips[b].path[0], strips[b].path[1]);
    if (!point || point.x < box.x || point.x > box.x + box.width || point.y < box.y || point.y > box.y + box.height) continue;
    const overA = (strips[a].index + strips[b].index + strips[a].directionIndex) % 2 === 0;
    crossings.push({ id: `${strips[a].id}:${strips[b].id}`, stripA: strips[a].id, stripB: strips[b].id, position: point, overStripId: overA ? strips[a].id : strips[b].id });
  }
  return { strips, crossings };
}

export function generateDocumentWeave(regions: WeaveRegion[], appearance: AppearanceSettings, customPatterns: PatternDefinition[] = []): GeneratedWeave {
  return regions.toSorted((a, b) => a.order - b.order).reduce<GeneratedWeave>((all, region) => {
    const generated = generateRegionWeave(region, appearance, customPatterns);
    all.strips.push(...generated.strips); all.crossings.push(...generated.crossings); return all;
  }, { strips: [], crossings: [] });
}
