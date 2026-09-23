import { describe, expect, it } from "vitest";
import { PATTERNS } from "../../patterns/library";
import { createInitialProject } from "../../store/useStudioStore";
import type { Point, WeaveRegion } from "../../types/weave";
import { detectAdjacencies } from "../adjacency";
import { generateDocumentWeave, generateRegionWeave, spacingForLayer } from "../patternGenerator";
import { generateTransition, makeTransition, patternSimilarity } from "../transition";
import { cutPath, splitPathAtLine } from "../stripEditing";

function region(id: string, patternId: string, boundary: Point[], order: number): WeaveRegion {
  const definition = PATTERNS.find((item) => item.id === patternId) ?? PATTERNS[0];
  return { id, name: id, boundary, order, locked: false, visible: true, color: order % 2 ? "#b88a52" : "#708f72", materialId: "natural-bamboo", boundaryMode: "trim", pattern: { patternId, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, density: order % 2 ? 100 : 60, stripWidth: order % 2 ? 5 : 3.5, directionLayers: structuredClone(definition.directionLayers), crossingRules: structuredClone(definition.crossingRules), crossingOverrides: {}, directionWidths: {}, directionColors: {}, localOverrides: {}, manualStrips: [] } };
}

describe("V4 parametric weave engine", () => {
  it("ships at least 20 vector topology patterns", () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(20);
    expect(PATTERNS.every((pattern) => pattern.structure.directions.length >= 2 && pattern.topology.dominantDirections.length >= 2)).toBe(true);
  });
  it("separates density from repeat scale", () => { const layer = PATTERNS[0].directionLayers[0]; expect(spacingForLayer(layer, 120, 1)).toBeLessThan(spacingForLayer(layer, 60, 1)); expect(spacingForLayer(layer, 100, 2)).toBeGreaterThan(spacingForLayer(layer, 100, 1)); });
  it("generates multi-direction strips and explicit over/under ownership", () => {
    const project = createInitialProject(); const item = region("hex-region", "hex", [{ x: 20, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 160 }, { x: 20, y: 160 }], 1); const weave = generateRegionWeave(item, project.appearance);
    expect(new Set(weave.strips.map((strip) => strip.directionIndex)).size).toBe(3); expect(weave.crossings.length).toBeGreaterThan(20); expect(weave.crossings.every((crossing) => crossing.overStripId === crossing.stripA || crossing.overStripId === crossing.stripB)).toBe(true);
  });
  it("changes one direction density without changing the other directions", () => {
    const project = createInitialProject(); const item = region("tri", "hex", [{ x: 0, y: 0 }, { x: 180, y: 0 }, { x: 180, y: 160 }, { x: 0, y: 160 }], 1);
    const low = structuredClone(item); low.pattern.directionLayers[1].density = 25; const high = structuredClone(item); high.pattern.directionLayers[1].density = 130;
    const lowWeave = generateRegionWeave(low, project.appearance); const highWeave = generateRegionWeave(high, project.appearance);
    expect(highWeave.strips.filter((strip) => strip.directionIndex === 1).length).toBeGreaterThan(lowWeave.strips.filter((strip) => strip.directionIndex === 1).length);
    expect(highWeave.strips.filter((strip) => strip.directionIndex === 0).length).toBe(lowWeave.strips.filter((strip) => strip.directionIndex === 0).length);
  });
  it("applies direction-pair crossing rules", () => {
    const project = createInitialProject(); const item = region("plain-rule", "plain", [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 100 }, { x: 0, y: 100 }], 1);
    item.pattern.crossingRules[0].mode = "a-over"; const weave = generateRegionWeave(item, project.appearance); const strips = new Map(weave.strips.map((strip) => [strip.id, strip]));
    expect(weave.crossings.length).toBeGreaterThan(10); expect(weave.crossings.every((crossing) => strips.get(crossing.overStripId)?.directionIndex === 0)).toBe(true);
  });
  it("supports any number of independent regions", () => {
    const project = createInitialProject(); const regions = [project.regions[0], region("a", "snowflake", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], 1), region("b", "diamond", [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }], 2), region("c", "hex", [{ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }], 3)];
    const weave = generateDocumentWeave(regions, project.appearance); expect(new Set(weave.strips.map((strip) => strip.regionId))).toEqual(new Set(["background", "a", "b", "c"]));
  });
  it("detects adjacency without relying on array positions", () => {
    const a = region("alpha", "plain", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], 1); const b = region("beta", "diamond", [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }], 2); const c = region("far", "hex", [{ x: 300, y: 200 }, { x: 360, y: 200 }, { x: 360, y: 260 }, { x: 300, y: 260 }], 3);
    const graph = detectAdjacencies([c, b, a]); expect(graph).toHaveLength(1); expect(new Set([graph[0].regionA, graph[0].regionB])).toEqual(new Set(["alpha", "beta"]));
  });
  it("creates continuous transition paths plus merge or split nodes", () => {
    const a = region("a", "snowflake", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], 1); const b = region("b", "diamond-hole", [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }], 2);
    const adjacency = detectAdjacencies([a, b])[0]; const zone = makeTransition(adjacency, 0); const result = generateTransition(zone, adjacency, a, b);
    expect(result.strips.length).toBeGreaterThan(5); expect(result.strips.every((strip) => strip.path.length >= 4)).toBe(true); expect(result.mergeNodes.length + result.splitNodes.length).toBeGreaterThan(0); expect(result.strips.every((strip) => strip.sourceStripIds.length > 0 && strip.targetStripIds.length > 0)).toBe(true); expect(result.warnings.some((warning) => warning.startsWith("FREE_FLOATING"))).toBe(false); expect(patternSimilarity(PATTERNS[0], PATTERNS[0])).toBe(1);
  });
  it("connects real 8-to-5 boundary strips with traceable merges", () => {
    const a = region("left-eight", "plain", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], 1); const b = region("right-five", "plain", [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }], 2);
    a.pattern.directionLayers[0].enabled = false; a.pattern.directionLayers[1].stripCount = 8; b.pattern.directionLayers[0].enabled = false; b.pattern.directionLayers[1].stripCount = 5;
    const adjacency = detectAdjacencies([a, b])[0]; const result = generateTransition(makeTransition(adjacency, 0), adjacency, a, b);
    expect(result.sourceEndpoints).toHaveLength(8); expect(result.targetEndpoints).toHaveLength(5); expect(result.sourceEndpoints.every((endpoint) => Math.abs(endpoint.point.x - 100) < .001)).toBe(true); expect(result.targetEndpoints.every((endpoint) => Math.abs(endpoint.point.x - 100) < .001)).toBe(true);
    expect(result.matches.some((match) => match.type === "merge")).toBe(true); expect(new Set(result.strips.flatMap((strip) => strip.sourceStripIds)).size).toBe(8); expect(new Set(result.strips.flatMap((strip) => strip.targetStripIds)).size).toBe(5);
  });
  it("connects real 5-to-8 boundary strips with traceable splits", () => {
    const a = region("left-five", "plain", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], 1); const b = region("right-eight", "plain", [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }], 2);
    a.pattern.directionLayers[0].enabled = false; a.pattern.directionLayers[1].stripCount = 5; a.pattern.directionLayers[1].spacing = 5; a.pattern.density = 100; b.pattern.directionLayers[0].enabled = false; b.pattern.directionLayers[1].stripCount = 8; b.pattern.directionLayers[1].spacing = 5; b.pattern.density = 100;
    const adjacency = detectAdjacencies([a, b])[0]; const result = generateTransition(makeTransition(adjacency, 0), adjacency, a, b);
    expect(result.sourceEndpoints).toHaveLength(5); expect(result.targetEndpoints).toHaveLength(8); expect(result.matches.some((match) => match.type === "split")).toBe(true); expect(result.splitNodes.length).toBeGreaterThan(0); expect(result.warnings).toEqual([]);
  });
  it("produces materially different transition strategies", () => {
    const a = region("a", "snowflake", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], 1); const b = region("b", "diamond", [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }], 2); const adjacency = detectAdjacencies([a, b])[0];
    const spacing = makeTransition(adjacency, 0); const fan = { ...spacing, strategy: "fan-out" as const, fanStrength: 90 }; const skip = { ...spacing, strategy: "skip-weave" as const, complexity: 90 };
    const spacingResult = generateTransition(spacing, adjacency, a, b); const fanResult = generateTransition(fan, adjacency, a, b); const skipResult = generateTransition(skip, adjacency, a, b);
    expect(fanResult.strips[0].path[Math.floor(fanResult.strips[0].path.length / 2)]).not.toEqual(spacingResult.strips[0].path[Math.floor(spacingResult.strips[0].path.length / 2)]); expect(skipResult.strips.every((strip) => strip.sourceStripIds.length > 0 && strip.targetStripIds.length > 0)).toBe(true);
  });
  it("moves a complete direction layer without moving the other layer", () => {
    const project = createInitialProject(); const item = region("move-layer", "plain", [{ x: 0, y: 0 }, { x: 140, y: 0 }, { x: 140, y: 100 }, { x: 0, y: 100 }], 1);
    const before = generateRegionWeave(item, project.appearance); item.pattern.directionLayers[0].offsetX = 18; item.pattern.directionLayers[0].offsetY = -7; const after = generateRegionWeave(item, project.appearance);
    expect(after.strips.find((strip) => strip.directionIndex === 0)!.path[0].x - before.strips.find((strip) => strip.directionIndex === 0)!.path[0].x).toBeCloseTo(18);
    expect(after.strips.find((strip) => strip.directionIndex === 1)!.path).toEqual(before.strips.find((strip) => strip.directionIndex === 1)!.path);
  });
  it("performs a true geometric cut and can delete either side", () => {
    const path = [{ x: 0, y: 50 }, { x: 100, y: 50 }]; const start = { x: 40, y: 0 }; const end = { x: 40, y: 100 };
    expect(splitPathAtLine(path, start, end)).toEqual([[{ x: 0, y: 50 }, { x: 40, y: 50 }], [{ x: 40, y: 50 }, { x: 100, y: 50 }]]);
    expect(cutPath(path, { start, end, scope: "all", mode: "keep-left" })).toHaveLength(1);
    expect(cutPath(path, { start, end, scope: "all", mode: "keep-right" })).toHaveLength(1);
  });
  it("persists manual strips and stable generated strip identity", () => {
    const project = createInitialProject(); const item = region("manual", "plain", [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 100 }, { x: 0, y: 100 }], 1);
    item.pattern.manualStrips.push({ id: "manual-one", directionLayerId: item.pattern.directionLayers[0].id, path: [{ x: 10, y: 12 }, { x: 90, y: 78 }], width: 4, color: "#112233" });
    const first = generateRegionWeave(item, project.appearance); const second = generateRegionWeave(item, project.appearance);
    expect(first.strips.find((strip) => strip.id === "manual-one")?.sourceType).toBe("manual"); expect(first.strips.map((strip) => strip.baseStripId)).toEqual(second.strips.map((strip) => strip.baseStripId));
  });
});
