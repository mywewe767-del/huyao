import { create } from "zustand";
import { PATTERNS } from "../patterns/library";
import { bounds, centroid, rotatePoint, scalePoints, translatePoints } from "../engine/geometry";
import { makeTransition } from "../engine/transition";
import { generateDocumentWeave } from "../engine/patternGenerator";
import { cutPath, pathIntersectsCut, stripMatchesCutScope } from "../engine/stripEditing";
import type { CanvasTool, CrossingMode, CutLineState, DirectionLayer, ManualStripDefinition, PatternDefinition, PatternInstance, Point, RegionAdjacency, StripOverride, TransitionZone, WeaveDocument, WeaveRegion } from "../types/weave";

const STORAGE_KEY = "bamboo-weave-studio:v4";
const regionColors = ["#c69b61", "#77966d", "#b77458", "#668b91", "#9a7ca8", "#d0ad55", "#6f7fa5"];

function patternInstance(patternId: string, customPatterns: PatternDefinition[] = []): PatternInstance {
  const pattern = customPatterns.find((item) => item.id === patternId) ?? PATTERNS.find((item) => item.id === patternId) ?? PATTERNS[0];
  return { patternId, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, density: 100, stripWidth: pattern.defaultStripWidth,
    directionLayers: structuredClone(pattern.directionLayers), crossingRules: structuredClone(pattern.crossingRules), crossingOverrides: {}, directionWidths: {}, directionColors: {}, localOverrides: {}, manualStrips: [] };
}

function region(id: string, name: string, patternId: string, boundary: Point[], order: number, locked = false): WeaveRegion {
  return { id, name, boundary, order, locked, visible: true, pattern: patternInstance(patternId), materialId: "natural-bamboo", color: regionColors[order % regionColors.length], boundaryMode: "trim" };
}

export function createInitialProject(): WeaveDocument {
  const width = 400; const height = 300;
  return {
    version: 4, name: "竹编结构设计 V4",
    canvas: { width, height, gridSize: 10, gridVisible: true, snapEnabled: true, basePatternId: "plain", backgroundColor: "#f7f2e8" },
    regions: [region("background", "背景 · 基础平编", "plain", [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }], 0, true)],
    transitions: [], customPatterns: [],
    materials: [{ id: "natural-bamboo", name: "Natural Bamboo", roughness: .62, color: "#c9a96e" }],
    appearance: { globalColor: "#c9a96e", thickness: 1.2, stripOverrides: {} }, updatedAt: new Date().toISOString(),
  };
}

interface StudioState {
  project: WeaveDocument;
  past: WeaveDocument[];
  future: WeaveDocument[];
  activeTool: CanvasTool;
  selectedPatternId: string;
  selectedRegionId: string | null;
  selectedStripId: string | null;
  selectedStripIds: string[];
  selectedCrossingId: string | null;
  selectedDirectionLayerId: string | null;
  selectedTransitionId: string | null;
  cutLine: CutLineState | null;
  viewMode: "2d" | "3d";
  zoom: number;
  pan: Point;
  brushSize: number;
  toast: string | null;
  setActiveTool: (tool: CanvasTool) => void;
  setSelectedPattern: (id: string) => void;
  selectRegion: (id: string | null) => void;
  selectStrip: (id: string | null) => void;
  selectCrossing: (regionId: string, id: string) => void;
  selectDirectionLayer: (regionId: string, id: string) => void;
  selectTransition: (id: string | null) => void;
  setViewMode: (mode: "2d" | "3d") => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: Point) => void;
  fitView: () => void;
  setBrushSize: (size: number) => void;
  setToast: (message: string | null) => void;
  addRegion: (boundary: Point[], patternId?: string) => string;
  updateRegion: (id: string, changes: Partial<WeaveRegion>) => void;
  updatePatternInstance: (id: string, changes: Partial<PatternInstance>) => void;
  updateDirectionLayer: (regionId: string, layerId: string, changes: Partial<DirectionLayer>) => void;
  addDirectionLayer: (regionId: string) => void;
  deleteDirectionLayer: (regionId: string, layerId: string) => void;
  updateCrossingRule: (regionId: string, ruleId: string, mode: CrossingMode) => void;
  toggleCrossing: (regionId: string, crossingId: string, stripA: string, stripB: string, currentOver: string) => void;
  moveRegion: (id: string, dx: number, dy: number) => void;
  resizeRegion: (id: string, sx: number, sy: number) => void;
  rotateRegion: (id: string, degrees: number) => void;
  updateRegionPoint: (id: string, index: number, point: Point) => void;
  deleteRegion: (id: string) => void;
  duplicateRegion: (id: string) => void;
  reorderRegion: (id: string, direction: -1 | 1) => void;
  applyPattern: (regionId: string, patternId: string) => void;
  addCustomPattern: (pattern: PatternDefinition) => void;
  updateCanvas: (width: number, height: number) => void;
  updateCanvasConfig: (changes: Partial<WeaveDocument["canvas"]>) => void;
  updateAppearance: (changes: Partial<WeaveDocument["appearance"]>) => void;
  updateStrip: (regionId: string, id: string, changes: StripOverride) => void;
  resetStrip: (regionId: string, id: string) => void;
  addManualStrip: (regionId: string, path: Point[], layerId?: string) => void;
  setCutLine: (cutLine: CutLineState | null) => void;
  updateCutLine: (changes: Partial<CutLineState>) => void;
  applyCut: () => void;
  generateAllTransitions: (adjacencies: RegionAdjacency[]) => void;
  addTransition: (adjacency: RegionAdjacency) => void;
  updateTransition: (id: string, changes: Partial<TransitionZone>) => void;
  deleteTransition: (id: string) => void;
  regenerateTransition: (id: string) => void;
  undo: () => void;
  redo: () => void;
  loadProject: (project: WeaveDocument) => void;
  resetProject: () => void;
}

const snapshot = (project: WeaveDocument) => structuredClone(project);
function changed(state: StudioState, recipe: (project: WeaveDocument) => WeaveDocument): Partial<StudioState> {
  const next = recipe(snapshot(state.project)); next.updatedAt = new Date().toISOString();
  return { project: next, past: [...state.past.slice(-49), snapshot(state.project)], future: [] };
}

export const useStudioStore = create<StudioState>((set) => ({
  project: createInitialProject(), past: [], future: [], activeTool: "select", selectedPatternId: "snowflake", selectedRegionId: null,
  selectedStripId: null, selectedStripIds: [], selectedCrossingId: null, selectedDirectionLayerId: null, selectedTransitionId: null, cutLine: null, viewMode: "2d", zoom: 1, pan: { x: 0, y: 0 }, brushSize: 24, toast: null,
  setActiveTool: (activeTool) => set({ activeTool }), setSelectedPattern: (selectedPatternId) => set({ selectedPatternId }),
  selectRegion: (selectedRegionId) => set({ selectedRegionId, selectedStripId: null, selectedStripIds: [], selectedCrossingId: null, selectedDirectionLayerId: null, selectedTransitionId: null }),
  selectStrip: (selectedStripId) => set({ selectedStripId, selectedStripIds: selectedStripId ? [selectedStripId] : [], selectedCrossingId: null }),
  selectCrossing: (selectedRegionId, selectedCrossingId) => set({ selectedRegionId, selectedCrossingId, selectedStripId: null, selectedStripIds: [], selectedTransitionId: null }),
  selectDirectionLayer: (selectedRegionId, selectedDirectionLayerId) => set((state) => ({ selectedRegionId, selectedDirectionLayerId: state.selectedDirectionLayerId === selectedDirectionLayerId ? null : selectedDirectionLayerId, selectedStripId: null, selectedStripIds: [], selectedCrossingId: null, selectedTransitionId: null })),
  selectTransition: (selectedTransitionId) => set({ selectedTransitionId, selectedRegionId: null, selectedStripId: null, selectedStripIds: [], selectedCrossingId: null, selectedDirectionLayerId: null }),
  setViewMode: (viewMode) => set({ viewMode }), setZoom: (zoom) => set({ zoom: Math.max(.35, Math.min(3.5, zoom)) }), setPan: (pan) => set({ pan }),
  fitView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }), setBrushSize: (brushSize) => set({ brushSize }), setToast: (toast) => set({ toast }),
  addRegion: (boundary, patternId) => {
    const id = `region-${crypto.randomUUID()}`;
    set((state) => changed(state, (project) => ({ ...project, regions: [...project.regions, region(id, `区域 ${project.regions.length}`, patternId ?? state.selectedPatternId, boundary, project.regions.length)] })));
    set({ selectedRegionId: id, selectedTransitionId: null, activeTool: "select" }); return id;
  },
  updateRegion: (id, changes) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id ? { ...item, ...changes } : item) }))),
  updatePatternInstance: (id, changes) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id ? { ...item, pattern: { ...item.pattern, ...changes } } : item) }))),
  updateDirectionLayer: (regionId, layerId, changes) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === regionId ? { ...item, pattern: { ...item.pattern, directionLayers: item.pattern.directionLayers.map((layer) => layer.id === layerId ? { ...layer, ...changes } : layer) } } : item) }))),
  addDirectionLayer: (regionId) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => { if (item.id !== regionId) return item; const index = item.pattern.directionLayers.length; const layer: DirectionLayer = { id: `${item.pattern.patternId}-custom-${crypto.randomUUID()}`, angle: (index * 45) % 180, spacing: 12, stripWidth: 3, stripCount: 0, density: 70, enabled: true, color: item.color, offsetX: 0, offsetY: 0, zOffset: 0, locked: false }; const rules = item.pattern.directionLayers.map((existing, ruleIndex) => ({ id: `${item.pattern.patternId}-custom-rule-${crypto.randomUUID()}-${ruleIndex}`, directionAId: existing.id, directionBId: layer.id, mode: "alternate" as const })); return { ...item, pattern: { ...item.pattern, directionLayers: [...item.pattern.directionLayers, layer], crossingRules: [...item.pattern.crossingRules, ...rules] } }; }) }))),
  deleteDirectionLayer: (regionId, layerId) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === regionId && item.pattern.directionLayers.length > 1 ? { ...item, pattern: { ...item.pattern, directionLayers: item.pattern.directionLayers.filter((layer) => layer.id !== layerId), crossingRules: item.pattern.crossingRules.filter((rule) => rule.directionAId !== layerId && rule.directionBId !== layerId) } } : item) }))),
  updateCrossingRule: (regionId, ruleId, mode) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === regionId ? { ...item, pattern: { ...item.pattern, crossingRules: item.pattern.crossingRules.map((rule) => rule.id === ruleId ? { ...rule, mode } : rule) } } : item) }))),
  toggleCrossing: (regionId, crossingId, stripA, stripB, currentOver) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === regionId ? { ...item, pattern: { ...item.pattern, crossingOverrides: { ...item.pattern.crossingOverrides, [crossingId]: currentOver === stripA ? stripB : stripA } } } : item) }))),
  moveRegion: (id, dx, dy) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id && !item.locked ? { ...item, boundary: translatePoints(item.boundary, dx, dy) } : item) }))),
  resizeRegion: (id, sx, sy) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id && !item.locked ? { ...item, boundary: scalePoints(item.boundary, bounds(item.boundary), sx, sy) } : item) }))),
  rotateRegion: (id, degrees) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id && !item.locked ? { ...item, boundary: item.boundary.map((point) => rotatePoint(point, centroid(item.boundary), degrees)), pattern: { ...item.pattern, rotation: item.pattern.rotation + degrees } } : item) }))),
  updateRegionPoint: (id, pointIndex, point) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id && !item.locked ? { ...item, boundary: item.boundary.map((current, index) => index === pointIndex ? point : current) } : item) }))),
  deleteRegion: (id) => set((state) => id === "background" ? state : ({ ...changed(state, (project) => ({ ...project, regions: project.regions.filter((item) => item.id !== id), transitions: project.transitions.filter((item) => !item.regionIds.includes(id)) })), selectedRegionId: null })),
  duplicateRegion: (id) => set((state) => changed(state, (project) => { const source = project.regions.find((item) => item.id === id); if (!source || source.id === "background") return project; const copyId = `region-${crypto.randomUUID()}`; const copy = structuredClone(source); return { ...project, regions: [...project.regions, { ...copy, id: copyId, name: `${source.name} 副本`, boundary: translatePoints(source.boundary, 12, 12), order: project.regions.length }] }; })),
  reorderRegion: (id, direction) => set((state) => changed(state, (project) => { const sorted = project.regions.toSorted((a, b) => a.order - b.order); const index = sorted.findIndex((item) => item.id === id); const target = Math.max(1, Math.min(sorted.length - 1, index + direction)); if (index <= 0 || target === index) return project; [sorted[index], sorted[target]] = [sorted[target], sorted[index]]; return { ...project, regions: sorted.map((item, order) => ({ ...item, order })) }; })),
  applyPattern: (regionId, patternId) => set((state) => changed(state, (project) => ({ ...project, canvas: regionId === "background" ? { ...project.canvas, basePatternId: patternId } : project.canvas, regions: project.regions.map((item) => item.id === regionId ? { ...item, pattern: patternInstance(patternId, project.customPatterns) } : item) }))),
  addCustomPattern: (pattern) => set((state) => ({ ...changed(state, (project) => ({ ...project, customPatterns: [...project.customPatterns.filter((item) => item.id !== pattern.id), pattern] })), selectedPatternId: pattern.id })),
  updateCanvas: (width, height) => set((state) => changed(state, (project) => { const sx = width / project.canvas.width; const sy = height / project.canvas.height; return { ...project, canvas: { ...project.canvas, width, height }, regions: project.regions.map((item) => ({ ...item, boundary: scalePoints(item.boundary, { x: 0, y: 0 }, sx, sy) })), transitions: project.transitions.map((item) => ({ ...item, controlPoints: scalePoints(item.controlPoints, { x: 0, y: 0 }, sx, sy) })) }; })),
  updateCanvasConfig: (changes) => set((state) => changed(state, (project) => ({ ...project, canvas: { ...project.canvas, ...changes } }))),
  updateAppearance: (changes) => set((state) => changed(state, (project) => ({ ...project, appearance: { ...project.appearance, ...changes } }))),
  updateStrip: (regionId, id, changes) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === regionId ? { ...item, pattern: { ...item.pattern, localOverrides: { ...item.pattern.localOverrides, [id]: { ...item.pattern.localOverrides[id], ...changes } } } } : item) }))),
  resetStrip: (regionId, id) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => { if (item.id !== regionId) return item; const localOverrides = { ...item.pattern.localOverrides }; delete localOverrides[id]; return { ...item, pattern: { ...item.pattern, localOverrides } }; }) }))),
  addManualStrip: (regionId, path, layerId) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => { if (item.id !== regionId || path.length < 2) return item; const layer = item.pattern.directionLayers.find((value) => value.id === layerId) ?? item.pattern.directionLayers[0]; const manual: ManualStripDefinition = { id: `${item.id}-manual-${crypto.randomUUID()}`, directionLayerId: layer.id, path, width: layer.stripWidth, color: layer.color ?? item.color }; return { ...item, pattern: { ...item.pattern, manualStrips: [...(item.pattern.manualStrips ?? []), manual] } }; }) }))),
  setCutLine: (cutLine) => set({ cutLine }),
  updateCutLine: (changes) => set((state) => {
    if (!state.cutLine) return { cutLine: null };
    const region = state.project.regions.find((item) => item.id === (changes.regionId ?? state.cutLine?.regionId ?? state.selectedRegionId));
    const layerId = changes.directionLayerId ?? state.cutLine.directionLayerId ?? state.selectedDirectionLayerId;
    const directionAngle = changes.directionAngle ?? region?.pattern.directionLayers.find((layer) => layer.id === layerId)?.angle;
    return { cutLine: { ...state.cutLine, ...changes, directionAngle } };
  }),
  applyCut: () => set((state) => {
    if (!state.cutLine) return state;
    const weave = generateDocumentWeave(state.project.regions, state.project.appearance, state.project.customPatterns); const cut = state.cutLine;
    const eligible = weave.strips.filter((strip) => stripMatchesCutScope(strip, cut, state.selectedStripIds) && pathIntersectsCut(strip.path, cut));
    if (!eligible.length) return { cutLine: null, toast: "切割线没有与适用范围内的竹条相交" };
    const bases = new Map<string, typeof weave.strips>();
    eligible.forEach((strip) => { if (!bases.has(strip.baseStripId)) bases.set(strip.baseStripId, weave.strips.filter((item) => item.baseStripId === strip.baseStripId)); });
    const result = changed(state, (project) => ({ ...project, regions: project.regions.map((item) => {
      const changes = [...bases.entries()].filter(([, strips]) => strips[0]?.regionId === item.id); if (!changes.length) return item;
      const localOverrides = { ...item.pattern.localOverrides };
      changes.forEach(([baseId, strips]) => { const nextSegments = strips.flatMap((strip) => pathIntersectsCut(strip.path, cut) ? cutPath(strip.path, cut) : [strip.path]); localOverrides[baseId] = { ...localOverrides[baseId], cutSegments: nextSegments }; });
      return { ...item, pattern: { ...item.pattern, localOverrides } };
    }) }));
    return { ...result, cutLine: null, selectedCrossingId: null, toast: `已切割 ${eligible.length} 根竹条` };
  }),
  generateAllTransitions: (adjacencies) => set((state) => changed(state, (project) => ({ ...project, transitions: adjacencies.map(makeTransition) }))),
  addTransition: (adjacency) => set((state) => changed(state, (project) => project.transitions.some((item) => item.adjacencyId === adjacency.id) ? project : { ...project, transitions: [...project.transitions, makeTransition(adjacency, project.transitions.length)] })),
  updateTransition: (id, changes) => set((state) => changed(state, (project) => ({ ...project, transitions: project.transitions.map((item) => item.id === id ? { ...item, ...changes } : item) }))),
  deleteTransition: (id) => set((state) => ({ ...changed(state, (project) => ({ ...project, transitions: project.transitions.filter((item) => item.id !== id) })), selectedTransitionId: null })),
  regenerateTransition: (id) => set((state) => changed(state, (project) => ({ ...project, transitions: project.transitions.map((item) => item.id === id ? { ...item, regenerationSeed: item.regenerationSeed + 1 } : item) }))),
  undo: () => set((state) => { const previous = state.past.at(-1); return previous ? { project: snapshot(previous), past: state.past.slice(0, -1), future: [snapshot(state.project), ...state.future].slice(0, 50) } : state; }),
  redo: () => set((state) => { const next = state.future[0]; return next ? { project: snapshot(next), past: [...state.past, snapshot(state.project)].slice(-50), future: state.future.slice(1) } : state; }),
  loadProject: (project) => set((state) => ({ project: snapshot(project), past: [...state.past, snapshot(state.project)].slice(-50), future: [], selectedRegionId: null, selectedStripId: null, selectedStripIds: [], selectedCrossingId: null, selectedDirectionLayerId: null, selectedTransitionId: null, cutLine: null })),
  resetProject: () => set((state) => ({ project: createInitialProject(), past: [...state.past, snapshot(state.project)].slice(-50), future: [], selectedRegionId: null, selectedStripId: null, selectedStripIds: [], selectedCrossingId: null, selectedDirectionLayerId: null, selectedTransitionId: null, cutLine: null, activeTool: "select", zoom: 1, pan: { x: 0, y: 0 } })),
}));

export function readAutosave(): WeaveDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("bamboo-weave-studio:v3") ?? localStorage.getItem("bamboo-weave-studio:v2"); if (!raw) return null;
    const value = JSON.parse(raw) as WeaveDocument;
    if (value.version === 4) return value;
    if ((value as unknown as { version: number }).version === 3) {
      const v3 = value as unknown as Omit<WeaveDocument, "version"> & { version: 3 };
      return { ...v3, version: 4, name: v3.name.replace(/V3/g, "V4"), regions: v3.regions.map((item) => ({ ...item, pattern: { ...item.pattern, manualStrips: item.pattern.manualStrips ?? [] } })) };
    }
    const legacy = value as unknown as Omit<WeaveDocument, "version"> & { version: 2 };
    if (legacy.version !== 2 || !Array.isArray(legacy.regions)) return null;
    const customPatterns = (legacy.customPatterns ?? []).map((pattern) => pattern.directionLayers ? pattern : { ...pattern, directionLayers: pattern.structure.directions.map((angle, index) => ({ id: `${pattern.id}-direction-${index}`, angle, spacing: 12, stripWidth: pattern.defaultStripWidth, stripCount: 0, density: pattern.defaultDensity, enabled: true })), crossingRules: [], variants: [{ id: "standard", name: "标准" }] });
    return { ...legacy, version: 4, name: legacy.name.replace(/V2/g, "V4"), customPatterns, regions: legacy.regions.map((item) => { const defaults = patternInstance(item.pattern.patternId, customPatterns); return { ...item, pattern: { ...defaults, ...item.pattern, scaleX: item.pattern.scaleX ?? item.pattern.scale ?? 1, scaleY: item.pattern.scaleY ?? item.pattern.scale ?? 1, directionLayers: item.pattern.directionLayers?.length ? item.pattern.directionLayers : defaults.directionLayers, crossingRules: item.pattern.crossingRules?.length ? item.pattern.crossingRules : defaults.crossingRules, crossingOverrides: item.pattern.crossingOverrides ?? {}, manualStrips: [] } }; }), transitions: legacy.transitions.map((item) => ({ ...item, strategy: item.strategy ?? "spacing-gradient", stageCount: item.stageCount ?? 12, bridgePatternIds: item.bridgePatternIds ?? [], regenerationSeed: item.regenerationSeed ?? 0, fanStrength: item.fanStrength ?? 45, spreadAngle: item.spreadAngle ?? 35, curves: item.curves ?? [] })) };
  } catch { return null; }
}
export function writeAutosave(project: WeaveDocument) { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }
