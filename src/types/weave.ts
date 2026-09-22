export interface Point { x: number; y: number }

export type CanvasTool = "select" | "direct" | "rectangle" | "polygon" | "brush" | "eraser" | "transition" | "gradient" | "crossing" | "pan";
export type PatternCategory = "basic" | "open" | "decorative" | "border";
export type TransitionMode = "natural" | "structural" | "decorative" | "experimental";
export type CrossingMode = "alternate" | "a-over" | "b-over" | "two-two" | "three-one" | "custom";
export type TransitionStrategy = "spacing-gradient" | "count-gradient" | "width-gradient" | "direction-rotation" | "frequency-shift" | "skip-weave" | "merge-split" | "fan-out" | "pattern-morph" | "bridge-pattern";

export interface DirectionLayer {
  id: string;
  angle: number;
  spacing: number;
  stripWidth: number;
  stripCount: number;
  density: number;
  enabled: boolean;
  color?: string;
  materialId?: string;
}

export interface CrossingRule {
  id: string;
  directionAId: string;
  directionBId: string;
  mode: CrossingMode;
  sequence?: number[];
}

export interface PatternVariant {
  id: string;
  name: string;
  densityMultiplier?: number;
  widthMultiplier?: number;
  scaleMultiplier?: number;
  rotation?: number;
}

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
  directionLayers: DirectionLayer[];
  crossingRules: CrossingRule[];
  variants: PatternVariant[];
  structure: PatternStructure;
  topology: PatternTopology;
  source?: "builtin" | "image" | "manual";
}

export interface PatternInstance {
  patternId: string;
  scale: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  density: number;
  stripWidth: number;
  directionLayers: DirectionLayer[];
  crossingRules: CrossingRule[];
  crossingOverrides: Record<string, string>;
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
  strategy: TransitionStrategy;
  smoothness: number;
  complexity: number;
  stageCount: number;
  directionLayerId?: string;
  bridgePatternIds: string[];
  regenerationSeed: number;
  fanCenter?: Point;
  fanStrength: number;
  spreadAngle: number;
  curves: TransitionCurve[];
  controlPoints: Point[];
  enabled: boolean;
  visible: boolean;
  locked: boolean;
}

export interface TransitionCurve {
  property: "density" | "spacing" | "width" | "angle" | "frequency";
  directionLayerId?: string;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  keyframes: { t: number; value: number }[];
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
  version: 3;
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
