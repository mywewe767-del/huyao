import { getPattern } from "../patterns/library";
import type { AppearanceSettings, Crossing, CrossingMode, CrossingRule, DirectionLayer, GeneratedWeave, PatternDefinition, Point, StripGeometry, WeaveRegion } from "../types/weave";
import { bounds, intersectSegments, rotatePoint } from "./geometry";

const palette = ["#d3b374", "#88a06e", "#b68a55", "#6f8b79", "#d6c28f", "#9c7552"];

function lineForAngle(angle: number, offset: number, box: ReturnType<typeof bounds>): Point[] {
  const diagonal = Math.hypot(box.width, box.height) * 1.7;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return [{ x: center.x - diagonal, y: center.y + offset }, { x: center.x + diagonal, y: center.y + offset }].map((point) => rotatePoint(point, center, angle));
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
    const radians = layer.angle * Math.PI / 180; const anisotropicScale = Math.hypot(Math.cos(radians) * region.pattern.scaleX, Math.sin(radians) * region.pattern.scaleY) || region.pattern.scale;
    const spacing = spacingForLayer(layer, region.pattern.density, anisotropicScale); const span = Math.hypot(box.width, box.height);
    const count = Math.min(180, layer.stripCount > 0 ? layer.stripCount : Math.ceil(span / spacing) + 3);
    const phase = (pattern.structure.phaseOffsets?.[directionIndex] ?? 0) * spacing;
    for (let slot = 0; slot < count; slot += 1) {
      const index = slot - (count - 1) / 2; const id = `${region.id}-${layer.id}-s${slot}`; const override = region.pattern.localOverrides[id] ?? appearance.stripOverrides[id];
      strips.push({ id, regionId: region.id, directionAngle: layer.angle + region.pattern.rotation, directionIndex,
        path: lineForAngle(layer.angle + region.pattern.rotation, index * spacing + phase, box), width: override?.width ?? width,
        color: override?.color ?? layer.color ?? region.pattern.directionColors?.[key] ?? (region.id === "background" ? appearance.globalColor : palette[directionIndex % palette.length] ?? region.color),
        index: slot, overUnderSequence: [] });
    }
  });
  const crossings: Crossing[] = []; const pairCounters = new Map<string, number>();
  for (let a = 0; a < strips.length; a += 1) for (let b = a + 1; b < strips.length; b += 1) {
    if (strips[a].directionIndex === strips[b].directionIndex) continue;
    const point = intersectSegments(strips[a].path[0], strips[a].path[1], strips[b].path[0], strips[b].path[1]);
    if (!point || point.x < box.x || point.x > box.x + box.width || point.y < box.y || point.y > box.y + box.height) continue;
    const layerA = layers[strips[a].directionIndex]; const layerB = layers[strips[b].directionIndex]; const pairKey = [layerA.id, layerB.id].sort().join(":");
    const counter = pairCounters.get(pairKey) ?? 0; pairCounters.set(pairKey, counter + 1);
    const { rule, reversed } = findRule(rules, layerA, layerB); const values = sequenceForMode(rule?.mode ?? "alternate", rule?.sequence);
    const accordingToRule = Boolean(values[(counter + strips[a].index + strips[b].index) % values.length]); const aOver = reversed ? !accordingToRule : accordingToRule;
    const id = `${strips[a].id}:${strips[b].id}`; const fallback = aOver ? strips[a].id : strips[b].id; const requested = region.pattern.crossingOverrides?.[id];
    crossings.push({ id, stripA: strips[a].id, stripB: strips[b].id, position: point, overStripId: requested === strips[a].id || requested === strips[b].id ? requested : fallback });
  }
  return { strips, crossings };
}

export function generateDocumentWeave(regions: WeaveRegion[], appearance: AppearanceSettings, customPatterns: PatternDefinition[] = []): GeneratedWeave {
  return regions.toSorted((a, b) => a.order - b.order).reduce<GeneratedWeave>((all, region) => { const generated = generateRegionWeave(region, appearance, customPatterns); all.strips.push(...generated.strips); all.crossings.push(...generated.crossings); return all; }, { strips: [], crossings: [] });
}
