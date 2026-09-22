export type Direction = "warp" | "weft" | "custom";
export type PatternKind = "orthogonal" | "diagonal" | "herringbone" | "diamond" | "hexagonal";

export interface Point { x: number; y: number }

export interface PatternStructure {
  kind: PatternKind;
  repeat: { width: number; height: number };
  directions: number[];
  overRule: "alternating" | "twill-3" | "herringbone" | "radial";
}

export interface WeavePattern {
  id: string;
  nameZh: string;
  nameEn: string;
  category: string;
  description: string;
  defaultDensity: number;
  defaultStripWidth: number;
  transitionTags: string[];
  structure: PatternStructure;
}

export interface PatternRegion {
  id: string;
  name: string;
  boundary: Point[];
  patternId: string;
  rotation: number;
  density: number;
  warpWidth: number;
  weftWidth: number;
  warpColor?: string;
  weftColor?: string;
  materialId: string;
}

export interface StripGeometry {
  id: string;
  regionId: string;
  direction: Direction;
  path: Point[];
  width: number;
  color: string;
  angle: number;
  index: number;
  overUnderSequence: boolean[];
}

export interface Crossing {
  id: string;
  stripA: string;
  stripB: string;
  position: Point;
  overStripId: string;
}

export interface TransitionConfig {
  enabled: boolean;
  width: number;
  strategy: "structural";
}

export interface CanvasSettings {
  width: number;
  height: number;
  gridSize: number;
}

export interface AppearanceSettings {
  globalColor: string;
  warpColor: string;
  weftColor: string;
  thickness: number;
  stripOverrides: Record<string, { color?: string; width?: number }>;
}

export interface BambooProject {
  version: 1;
  name: string;
  canvas: CanvasSettings;
  regions: PatternRegion[];
  transition: TransitionConfig;
  appearance: AppearanceSettings;
  updatedAt: string;
}

export interface GeneratedWeave {
  strips: StripGeometry[];
  crossings: Crossing[];
}
