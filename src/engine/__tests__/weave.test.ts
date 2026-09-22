import { describe, expect, it } from "vitest";
import { PATTERNS } from "../../patterns/library";
import { createInitialProject } from "../../store/useStudioStore";
import type { Point, WeaveRegion } from "../../types/weave";
import { detectAdjacencies } from "../adjacency";
import { generateDocumentWeave, generateRegionWeave, spacingForDensity } from "../patternGenerator";
import { generateTransition, makeTransition, patternSimilarity } from "../transition";

function region(id: string, patternId: string, boundary: Point[], order: number): WeaveRegion {
  return { id, name: id, boundary, order, locked: false, visible: true, color: order % 2 ? "#b88a52" : "#708f72", materialId: "natural-bamboo", boundaryMode: "trim", pattern: { patternId, scale: 1, rotation: 0, density: order % 2 ? 76 : 42, stripWidth: order % 2 ? 5 : 3.5, directionWidths: {}, directionColors: {}, localOverrides: {} } };
}

describe("V2 parametric weave engine", () => {
  it("ships at least 20 vector topology patterns", () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(20);
    expect(PATTERNS.every((pattern) => pattern.structure.directions.length >= 2 && pattern.topology.dominantDirections.length >= 2)).toBe(true);
  });
  it("reduces spacing as density increases", () => { expect(spacingForDensity(80, 5)).toBeLessThan(spacingForDensity(40, 5)); });
  it("generates multi-direction strips and explicit over/under ownership", () => {
    const project = createInitialProject(); const item = region("hex-region", "hex", [{ x: 20, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 160 }, { x: 20, y: 160 }], 1); const weave = generateRegionWeave(item, project.appearance);
    expect(new Set(weave.strips.map((strip) => strip.directionIndex)).size).toBe(3); expect(weave.crossings.length).toBeGreaterThan(20); expect(weave.crossings.every((crossing) => crossing.overStripId === crossing.stripA || crossing.overStripId === crossing.stripB)).toBe(true);
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
    expect(result.strips.length).toBeGreaterThan(5); expect(result.strips.every((strip) => strip.path.length === 3)).toBe(true); expect(result.mergeNodes.length + result.splitNodes.length).toBeGreaterThan(0); expect(patternSimilarity(PATTERNS[0], PATTERNS[0])).toBe(1);
  });
});
