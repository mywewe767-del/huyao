import { describe, expect, it } from "vitest";
import { generateProjectWeave, generateRegionWeave, spacingForDensity } from "../patternGenerator";
import { generateDensityTransition } from "../transition";
import type { BambooProject } from "../../types/weave";

function createProject(): BambooProject {
  const appearance = { globalColor: "#c9a96e", warpColor: "#d6b879", weftColor: "#8ca66b", thickness: 1.2, stripOverrides: {} };
  return {
    version: 1, name: "test", canvas: { width: 300, height: 200, gridSize: 10 }, appearance,
    transition: { enabled: false, width: 40, strategy: "structural" }, updatedAt: "2026-01-01T00:00:00.000Z",
    regions: [
      { id: "region-left", name: "left", patternId: "plain", rotation: 0, density: 72, warpWidth: 5, weftWidth: 4, materialId: "natural", boundary: [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 200 }, { x: 0, y: 200 }] },
      { id: "region-right", name: "right", patternId: "diamond", rotation: 0, density: 58, warpWidth: 5, weftWidth: 4, materialId: "natural", boundary: [{ x: 150, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 150, y: 200 }] },
    ],
  };
}

describe("parametric weave engine", () => {
  it("reduces spacing as density increases", () => {
    expect(spacingForDensity(80, 5)).toBeLessThan(spacingForDensity(40, 5));
  });

  it("generates vector strips and explicit crossing ownership", () => {
    const project = createProject();
    const weave = generateRegionWeave(project.regions[0], project.appearance);
    expect(weave.strips.length).toBeGreaterThan(20);
    expect(weave.crossings.length).toBeGreaterThan(20);
    expect(weave.crossings.every((crossing) => crossing.overStripId === crossing.stripA || crossing.overStripId === crossing.stripB)).toBe(true);
  });

  it("keeps generated geometry separated by region", () => {
    const project = createProject();
    const weave = generateProjectWeave(project.regions, project.appearance);
    expect(new Set(weave.strips.map((strip) => strip.regionId))).toEqual(new Set(["region-left", "region-right"]));
  });

  it("generates a gradual transition spanning the shared boundary", () => {
    const project = createProject();
    const result = generateDensityTransition(project.regions[0], project.regions[1], { ...project.transition, enabled: true }, project.appearance);
    expect(result.strips.length).toBeGreaterThan(10);
    const warpWidths = result.strips.filter((strip) => strip.direction === "warp").map((strip) => strip.width);
    expect(warpWidths[0]).toBe(project.regions[0].warpWidth);
    expect(warpWidths.at(-1)).toBe(project.regions[1].warpWidth);
  });
});
