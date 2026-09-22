import type { WeavePattern } from "../types/weave";

export const PATTERNS: WeavePattern[] = [
  {
    id: "plain", nameZh: "基础平编", nameEn: "Plain Weave", category: "基础",
    description: "一上一下，稳定均衡", defaultDensity: 72, defaultStripWidth: 5,
    transitionTags: ["grid", "stable"],
    structure: { kind: "orthogonal", repeat: { width: 16, height: 16 }, directions: [90, 0], overRule: "alternating" },
  },
  {
    id: "twill", nameZh: "斜纹编", nameEn: "Twill Weave", category: "斜纹",
    description: "三步循环形成连续斜线", defaultDensity: 68, defaultStripWidth: 5,
    transitionTags: ["grid", "directional"],
    structure: { kind: "orthogonal", repeat: { width: 24, height: 24 }, directions: [90, 0], overRule: "twill-3" },
  },
  {
    id: "herringbone", nameZh: "人字编", nameEn: "Herringbone", category: "斜纹",
    description: "斜向节奏交替反转", defaultDensity: 64, defaultStripWidth: 4.5,
    transitionTags: ["directional", "chevron"],
    structure: { kind: "herringbone", repeat: { width: 32, height: 24 }, directions: [45, -45], overRule: "herringbone" },
  },
  {
    id: "diamond", nameZh: "菱形编", nameEn: "Diamond Weave", category: "几何",
    description: "双向斜条构成菱形孔隙", defaultDensity: 58, defaultStripWidth: 4,
    transitionTags: ["directional", "open"],
    structure: { kind: "diamond", repeat: { width: 32, height: 32 }, directions: [45, -45], overRule: "alternating" },
  },
  {
    id: "hex", nameZh: "六角孔编", nameEn: "Hexagonal Weave", category: "孔编",
    description: "三向条带形成通透六角孔", defaultDensity: 48, defaultStripWidth: 3.6,
    transitionTags: ["open", "tri-axial"],
    structure: { kind: "hexagonal", repeat: { width: 36, height: 31 }, directions: [0, 60, -60], overRule: "alternating" },
  },
  {
    id: "square", nameZh: "方格编", nameEn: "Square Lattice", category: "几何",
    description: "成组经纬形成方格节奏", defaultDensity: 52, defaultStripWidth: 5.5,
    transitionTags: ["grid", "open"],
    structure: { kind: "orthogonal", repeat: { width: 28, height: 28 }, directions: [90, 0], overRule: "herringbone" },
  },
];

export const getPattern = (id: string) => PATTERNS.find((pattern) => pattern.id === id) ?? PATTERNS[0];
