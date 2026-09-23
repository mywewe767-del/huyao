import { getPattern } from "../patterns/library";
import type { AppearanceSettings, Crossing, CrossingMode, CrossingRule, DirectionLayer, GeneratedWeave, PatternDefinition, Point, StripGeometry, WeaveRegion } from "../types/weave";
import { bounds, intersectSegments, rotatePoint, translatePoints } from "./geometry";

const palette = ["#d3b374", "#88a06e", "#b68a55", "#6f8b79", "#d6c28f", "#9c7552"];

function lineForAngle(angle: number, offset: number, box: ReturnType<typeof bounds>, offsetX = 0, offsetY = 0): Point[] {
  const diagonal = Math.hypot(box.width, box.height) * 1.7;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return [{ x: center.x - diagonal, y: center.y + offset }, { x: center.x + diagonal, y: center.y + offset }].map((point) => rotatePoint(point, center, angle)).map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }));
}

function firstPathIntersection(a: Point[], b: Point[]): Point | null {
  for (let ai = 0; ai < a.length - 1; ai += 1) for (let bi = 0; bi < b.length - 1; bi += 1) {
    const point = intersectSegments(a[ai], a[ai + 1], b[bi], b[bi + 1]); if (point) return point;
  }
  return null;
}

export function resolvedDirectionLayers(region: WeaveRegion, pattern: PatternDefinition): DirectionLayer[] {
  return region.pattern.directionLayers?.length ? region.pattern.directionLayers : pattern.directionLayers.map((layer) => ({ ...layer }));
}

export function spacingForLayer(layer: DirectionLayer, globalDensity: number, scale: number): number {
  const densityFactor = Math.max(.15, globalDensity / 100) * Math.max(.15, layer.density / 100);
  return Math.max(layer.stripWidth * 1.02, layer.spacing * scale / densityFactor);
}

function sequenceForMode(mode: CrossingMode, custom?: number[]): number[] {
  if (mode === "a-over") return [1];
  if (mode === "b-over") return [0];
  if (mode === "two-two") return [1, 1, 0, 0];
  if (mode === "three-one") return [1, 1, 1, 0];
  if (mode === "custom" && custom?.length) return custom;
  return [1, 0];
}

function findRule(rules: CrossingRule[], a: DirectionLayer, b: DirectionLayer): { rule?: CrossingRule; reversed: boolean } {
  const direct = rules.find((rule) => rule.directionAId === a.id && rule.directionBId === b.id);
  if (direct) return { rule: direct, reversed: false };
  return { rule: rules.find((rule) => rule.directionAId === b.id && rule.directionBId === a.id), reversed: true };
}

export function generateRegionWeave(region: WeaveRegion, appearance: AppearanceSettings, customPatterns: PatternDefinition[] = []): GeneratedWeave {
  if (!region.visible) return { strips: [], crossings: [] };
  const pattern = getPattern(region.pattern.patternId, customPatterns);
  const box = bounds(region.boundary); const layers = resolvedDirectionLayers(region, pattern);
  const rules = region.pattern.crossingRules?.length ? region.pattern.crossingRules : pattern.crossingRules;
  const strips: StripGeometry[] = [];
  layers.forEach((layer, directionIndex) => {
    if (!layer.enabled) return;
    const key = String(directionIndex); const width = Math.max(.8, region.pattern.directionWidths?.[key] ?? layer.stripWidth ?? region.pattern.stripWidth);
    const resolvedAngle = layer.angle + (layer.rotationOffset ?? 0) + region.pattern.rotation;
    const radians = resolvedAngle * Math.PI / 180; const anisotropicScale = Math.hypot(Math.cos(radians) * region.pattern.scaleX, Math.sin(radians) * region.pattern.scaleY) || region.pattern.scale;
    const spacing = spacingForLayer(layer, region.pattern.density, anisotropicScale); const span = Math.hypot(box.width, box.height);
    const count = Math.min(180, layer.stripCount > 0 ? layer.stripCount : Math.ceil(span / spacing) + 3);
    const phase = (pattern.structure.phaseOffsets?.[directionIndex] ?? 0) * spacing;
    for (let slot = 0; slot < count; slot += 1) {
      const index = slot - (count - 1) / 2; const baseId = `${region.id}-${layer.id}-s${slot}`; const override = region.pattern.localOverrides[baseId] ?? appearance.stripOverrides[baseId];
      const generated = lineForAngle(resolvedAngle, index * spacing + phase, box, layer.offsetX, layer.offsetY);
      const editedPath = override?.manualPathOverride?.length ? override.manualPathOverride : translatePoints(generated, override?.offsetX ?? 0, override?.offsetY ?? 0);
      const segments = override?.cutSegments?.length ? override.cutSegments : [editedPath];
      segments.forEach((path, segmentIndex) => strips.push({ id: segments.length > 1 ? `${baseId}::cut:${segmentIndex}` : baseId, baseStripId: baseId, regionId: region.id, directionLayerId: layer.id, directionAngle: resolvedAngle, directionIndex,
        path, width: override?.width ?? width, zOffset: (layer.zOffset ?? 0) + (override?.zOffset ?? 0), sourceType: "generated",
        color: override?.color ?? layer.color ?? region.pattern.directionColors?.[key] ?? (region.id === "background" ? appearance.globalColor : palette[directionIndex % palette.length] ?? region.color),
        index: slot, overUnderSequence: [] }));
    }
  });
  (region.pattern.manualStrips ?? []).forEach((manual, index) => {
    const directionIndex = Math.max(0, layers.findIndex((layer) => layer.id === manual.directionLayerId)); const layer = layers[directionIndex] ?? layers[0];
    const override = region.pattern.localOverrides[manual.id]; const path = override?.manualPathOverride?.length ? override.manualPathOverride : translatePoints(manual.path, override?.offsetX ?? 0, override?.offsetY ?? 0);
    const segments = override?.cutSegments?.length ? override.cutSegments : [path]; const angle = Math.atan2(path.at(-1)!.y - path[0].y, path.at(-1)!.x - path[0].x) * 180 / Math.PI;
    segments.forEach((segment, segmentIndex) => strips.push({ id: segments.length > 1 ? `${manual.id}::cut:${segmentIndex}` : manual.id, baseStripId: manual.id, regionId: region.id, directionLayerId: manual.directionLayerId, directionAngle: angle, directionIndex, path: segment, width: override?.width ?? manual.width, color: override?.color ?? manual.color, index: 1000 + index, overUnderSequence: [], sourceType: "manual", zOffset: (layer?.zOffset ?? 0) + (manual.zOffset ?? 0) + (override?.zOffset ?? 0) }));
  });
  const crossings: Crossing[] = []; const pairCounters = new Map<string, number>();
  for (let a = 0; a < strips.length; a += 1) for (let b = a + 1; b < strips.length; b += 1) {
    if (strips[a].directionIndex === strips[b].directionIndex) continue;
    const point = firstPathIntersection(strips[a].path, strips[b].path);
    if (!point || point.x < box.x || point.x > box.x + box.width || point.y < box.y || point.y > box.y + box.height) continue;
    const layerA = layers[strips[a].directionIndex]; const layerB = layers[strips[b].directionIndex]; const pairKey = [layerA.id, layerB.id].sort().join(":");
    const counter = pairCounters.get(pairKey) ?? 0; pairCounters.set(pairKey, counter + 1);
    const { rule, reversed } = findRule(rules, layerA, layerB); const values = sequenceForMode(rule?.mode ?? "alternate", rule?.sequence);
    const accordingToRule = Boolean(values[(counter + strips[a].index + strips[b].index) % values.length]); const aOver = reversed ? !accordingToRule : accordingToRule;
    const id = `${strips[a].id}:${strips[b].id}`; const fallback = aOver ? strips[a].id : strips[b].id; const requested = region.pattern.crossingOverrides?.[id];
    crossings.push({ id, regionId: region.id, stripA: strips[a].id, stripB: strips[b].id, position: point, overStripId: requested === strips[a].id || requested === strips[b].id ? requested : fallback });
  }
  return { strips, crossings };
}

export function generateDocumentWeave(regions: WeaveRegion[], appearance: AppearanceSettings, customPatterns: PatternDefinition[] = []): GeneratedWeave {
  return regions.toSorted((a, b) => a.order - b.order).reduce<GeneratedWeave>((all, region) => { const generated = generateRegionWeave(region, appearance, customPatterns); all.strips.push(...generated.strips); all.crossings.push(...generated.crossings); return all; }, { strips: [], crossings: [] });
}
