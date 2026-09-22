export interface Point { x: number; y: number }

export type CanvasTool = "select" | "direct" | "rectangle" | "polygon" | "brush" | "eraser" | "transition" | "gradient" | "pan";
export type PatternCategory = "basic" | "open" | "decorative" | "border";
export type TransitionMode = "natural" | "structural" | "experimental";

export interface PatternTopology {
  dominantDirections: number[];
  stripCountX: number;
  stripCountY: number;
  junctionTypes: string[];
  holeTypes: string[];
  averageAngle: number;
  crossingDensity: number;
  openness: number;
  periodicity: number;
}

export interface PatternStructure {
  repeat: { width: number; height: number };
  directions: number[];
  overRule: "alternating" | "twill-3" | "twill-4" | "basket" | "herringbone" | "radial";
  directionSpacing?: number[];
  phaseOffsets?: number[];
}

export interface PatternDefinition {
  id: string;
  nameZh: string;
  nameEn: string;
  category: PatternCategory;
  description: string;
  defaultDensity: number;
  defaultStripWidth: number;
  transitionTags: string[];
  structure: PatternStructure;
  topology: PatternTopology;
  source?: "builtin" | "image" | "manual";
}

export interface PatternInstance {
  patternId: string;
  scale: number;
  rotation: number;
  density: number;
  stripWidth: number;
  directionWidths: Record<string, number>;
  directionColors: Record<string, string>;
  localOverrides: Record<string, { color?: string; width?: number }>;
}

export interface WeaveRegion {
  id: string;
  name: string;
  boundary: Point[];
  pattern: PatternInstance;
  materialId: string;
  color: string;
  visible: boolean;
  locked: boolean;
  order: number;
  boundaryMode: "trim";
}

export interface StripGeometry {
  id: string;
  regionId: string;
  directionAngle: number;
  directionIndex: number;
  path: Point[];
  width: number;
  color: string;
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

export interface StripMergeNode { id: string; incomingStripIds: string[]; outgoingStripId: string; position: Point }
export interface StripSplitNode { id: string; incomingStripId: string; outgoingStripIds: string[]; position: Point }

export interface RegionAdjacency {
  id: string;
  regionA: string;
  regionB: string;
  sharedBoundary: Point[];
  center: Point;
  length: number;
}

export interface TransitionZone {
  id: string;
  name: string;
  regionIds: [string, string];
  adjacencyId: string;
  width: number;
  mode: TransitionMode;
  smoothness: number;
  complexity: number;
  controlPoints: Point[];
  enabled: boolean;
  visible: boolean;
  locked: boolean;
}

export interface CanvasConfig {
  width: number;
  height: number;
  gridSize: number;
  gridVisible: boolean;
  snapEnabled: boolean;
  basePatternId: string;
  backgroundColor: string;
}

export interface MaterialDefinition { id: string; name: string; roughness: number; color: string }

export interface AppearanceSettings {
  globalColor: string;
  thickness: number;
  stripOverrides: Record<string, { color?: string; width?: number }>;
}

export interface WeaveDocument {
  version: 2;
  name: string;
  canvas: CanvasConfig;
  regions: WeaveRegion[];
  transitions: TransitionZone[];
  customPatterns: PatternDefinition[];
  materials: MaterialDefinition[];
  appearance: AppearanceSettings;
  updatedAt: string;
}

export interface GeneratedWeave { strips: StripGeometry[]; crossings: Crossing[] }
