import type { PatternCategory, PatternDefinition } from "../types/weave";

type Rule = PatternDefinition["structure"]["overRule"];
type Seed = [string, string, string, PatternCategory, number[], Rule, number, number, string[], string[]];

const seeds: Seed[] = [
  ["plain", "基础平编", "Plain Weave", "basic", [90, 0], "alternating", 74, 5, ["grid"], ["square"]],
  ["twill", "斜纹编", "Twill Weave", "basic", [90, 0], "twill-3", 70, 5, ["grid", "directional"], ["square"]],
  ["twill-22", "二上二下斜纹", "2/2 Twill", "basic", [90, 0], "twill-4", 68, 4.8, ["grid", "directional"], ["square"]],
  ["twill-31", "三上一下斜纹", "3/1 Twill", "basic", [90, 0], "twill-4", 72, 4.5, ["grid", "directional"], ["square"]],
  ["basket", "席纹编", "Basket Weave", "basic", [90, 0], "basket", 62, 5.8, ["grid", "grouped"], ["square"]],
  ["herringbone", "人字编", "Herringbone", "basic", [45, -45], "herringbone", 64, 4.5, ["chevron"], ["diamond"]],
  ["diagonal", "对角编", "Diagonal Weave", "basic", [60, -30], "alternating", 61, 4.4, ["directional"], ["rhombus"]],
  ["cross", "十字编", "Cross Weave", "basic", [90, 0, 45], "alternating", 65, 3.8, ["multi-direction"], ["triangle"]],
  ["checker", "棋盘编", "Checker Weave", "basic", [90, 0], "basket", 56, 6, ["grid", "grouped"], ["square"]],
  ["hex", "六角编", "Hexagonal Weave", "open", [0, 60, 120], "alternating", 48, 3.6, ["tri-axial", "open"], ["hexagon"]],
  ["hex-hole", "六角眼", "Hexagonal Hole", "open", [0, 60, 120], "basket", 38, 3.2, ["tri-axial", "open"], ["hexagon"]],
  ["diamond", "菱形编", "Diamond Weave", "open", [45, -45], "alternating", 56, 4, ["directional", "open"], ["diamond"]],
  ["diamond-hole", "菱形孔编", "Diamond Hole", "open", [45, -45], "basket", 41, 3.4, ["directional", "open"], ["diamond"]],
  ["square-hole", "方孔编", "Square Hole", "open", [90, 0], "alternating", 40, 3.3, ["grid", "open"], ["square"]],
  ["triangle-hole", "三角孔编", "Triangular Hole", "open", [0, 60, 120], "twill-3", 43, 3.1, ["tri-axial", "open"], ["triangle"]],
  ["rhombus-open", "斜菱孔编", "Rhombus Open", "open", [35, -55], "alternating", 36, 3.5, ["directional", "open"], ["rhombus"]],
  ["honeycomb", "蜂巢编", "Honeycomb", "open", [0, 60, 120], "herringbone", 45, 3.6, ["tri-axial", "cellular"], ["hexagon"]],
  ["star-hole", "星孔编", "Star Hole", "open", [0, 45, 90, 135], "twill-4", 42, 2.8, ["multi-direction", "open"], ["star"]],
  ["snowflake", "雪花编", "Snowflake", "decorative", [0, 45, 90, 135], "herringbone", 54, 3, ["radial", "decorative"], ["star"]],
  ["chrysanthemum", "菊花编", "Chrysanthemum", "decorative", [0, 30, 60, 90, 120, 150], "radial", 46, 2.6, ["radial", "decorative"], ["flower"]],
  ["rice", "米字编", "Rice Character", "decorative", [0, 45, 90, 135], "alternating", 60, 3.2, ["radial", "grid"], ["star"]],
  ["diamond-flower", "菱花编", "Diamond Flower", "decorative", [45, -45, 90], "herringbone", 52, 3.2, ["decorative", "directional"], ["diamond"]],
  ["double-leaf", "双叶编", "Double Leaf", "decorative", [25, -25, 90], "twill-3", 49, 3.1, ["organic", "decorative"], ["leaf"]],
  ["bauhinia", "紫荆花编", "Bauhinia Flower", "decorative", [0, 36, 72, 108, 144], "radial", 44, 2.8, ["radial", "decorative"], ["flower"]],
  ["cross-flower", "十字花编", "Cross Flower", "decorative", [0, 45, 90, 135], "basket", 51, 3.4, ["radial", "decorative"], ["cross"]],
  ["meander", "回纹编", "Meander Weave", "border", [90, 0], "twill-4", 58, 4.2, ["border", "grid"], ["square"]],
  ["bamboo-border", "竹纹边", "Bamboo Border", "border", [90, 0, 30], "basket", 60, 4, ["border", "directional"], ["stripe"]],
  ["song-brocade", "宋锦编", "Song Brocade", "decorative", [0, 30, 60, 90, 120, 150], "twill-3", 67, 2.5, ["multi-direction", "dense"], ["flower"]],
];

export const PATTERNS: PatternDefinition[] = seeds.map(([id, nameZh, nameEn, category, directions, overRule, density, width, tags, holes], index) => ({
  id, nameZh, nameEn, category,
  description: `${directions.length} 向参数化结构 · ${holes[0]} 单元`,
  defaultDensity: density, defaultStripWidth: width, transitionTags: tags,
  structure: {
    repeat: { width: 20 + (index % 4) * 6, height: 20 + (index % 3) * 7 }, directions, overRule,
    directionSpacing: directions.map((_, directionIndex) => 1 + ((index + directionIndex) % 3) * .12),
    phaseOffsets: directions.map((_, directionIndex) => ((index + directionIndex) % 2) * .5),
  },
  topology: {
    dominantDirections: directions, stripCountX: Math.max(1, directions.length), stripCountY: Math.max(1, directions.length - 1),
    junctionTypes: directions.length > 2 ? ["multi-way"] : ["crossing"], holeTypes: holes,
    averageAngle: directions.reduce((sum, angle) => sum + angle, 0) / directions.length,
    crossingDensity: density / 100, openness: 1 - density / 100, periodicity: 1,
  },
  source: "builtin",
}));

export const getPattern = (id: string, custom: PatternDefinition[] = []) => custom.find((pattern) => pattern.id === id) ?? PATTERNS.find((pattern) => pattern.id === id) ?? PATTERNS[0];
