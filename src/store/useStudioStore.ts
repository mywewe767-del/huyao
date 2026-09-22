import { create } from "zustand";
import { PATTERNS } from "../patterns/library";
import { bounds, centroid, rotatePoint, scalePoints, translatePoints } from "../engine/geometry";
import { makeTransition } from "../engine/transition";
import type { CanvasTool, PatternInstance, Point, RegionAdjacency, TransitionZone, WeaveDocument, WeaveRegion } from "../types/weave";

const STORAGE_KEY = "bamboo-weave-studio:v2";
const regionColors = ["#c69b61", "#77966d", "#b77458", "#668b91", "#9a7ca8", "#d0ad55", "#6f7fa5"];

function patternInstance(patternId: string): PatternInstance {
  const pattern = PATTERNS.find((item) => item.id === patternId) ?? PATTERNS[0];
  return { patternId, scale: 1, rotation: 0, density: pattern.defaultDensity, stripWidth: pattern.defaultStripWidth, directionWidths: {}, directionColors: {}, localOverrides: {} };
}

function region(id: string, name: string, patternId: string, boundary: Point[], order: number, locked = false): WeaveRegion {
  return { id, name, boundary, order, locked, visible: true, pattern: patternInstance(patternId), materialId: "natural-bamboo", color: regionColors[order % regionColors.length], boundaryMode: "trim" };
}

export function createInitialProject(): WeaveDocument {
  const width = 400; const height = 300;
  return {
    version: 2, name: "竹编结构设计 V2",
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
  selectedTransitionId: string | null;
  viewMode: "2d" | "3d";
  zoom: number;
  pan: Point;
  brushSize: number;
  toast: string | null;
  setActiveTool: (tool: CanvasTool) => void;
  setSelectedPattern: (id: string) => void;
  selectRegion: (id: string | null) => void;
  selectStrip: (id: string | null) => void;
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
  moveRegion: (id: string, dx: number, dy: number) => void;
  resizeRegion: (id: string, sx: number, sy: number) => void;
  rotateRegion: (id: string, degrees: number) => void;
  updateRegionPoint: (id: string, index: number, point: Point) => void;
  deleteRegion: (id: string) => void;
  duplicateRegion: (id: string) => void;
  reorderRegion: (id: string, direction: -1 | 1) => void;
  applyPattern: (regionId: string, patternId: string) => void;
  updateCanvas: (width: number, height: number) => void;
  updateCanvasConfig: (changes: Partial<WeaveDocument["canvas"]>) => void;
  updateAppearance: (changes: Partial<WeaveDocument["appearance"]>) => void;
  updateStrip: (regionId: string, id: string, changes: { color?: string; width?: number }) => void;
  generateAllTransitions: (adjacencies: RegionAdjacency[]) => void;
  addTransition: (adjacency: RegionAdjacency) => void;
  updateTransition: (id: string, changes: Partial<TransitionZone>) => void;
  deleteTransition: (id: string) => void;
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
  selectedStripId: null, selectedTransitionId: null, viewMode: "2d", zoom: 1, pan: { x: 0, y: 0 }, brushSize: 24, toast: null,
  setActiveTool: (activeTool) => set({ activeTool }), setSelectedPattern: (selectedPatternId) => set({ selectedPatternId }),
  selectRegion: (selectedRegionId) => set({ selectedRegionId, selectedStripId: null, selectedTransitionId: null }),
  selectStrip: (selectedStripId) => set({ selectedStripId }), selectTransition: (selectedTransitionId) => set({ selectedTransitionId, selectedRegionId: null, selectedStripId: null }),
  setViewMode: (viewMode) => set({ viewMode }), setZoom: (zoom) => set({ zoom: Math.max(.35, Math.min(3.5, zoom)) }), setPan: (pan) => set({ pan }),
  fitView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }), setBrushSize: (brushSize) => set({ brushSize }), setToast: (toast) => set({ toast }),
  addRegion: (boundary, patternId) => {
    const id = `region-${crypto.randomUUID()}`;
    set((state) => changed(state, (project) => ({ ...project, regions: [...project.regions, region(id, `区域 ${project.regions.length}`, patternId ?? state.selectedPatternId, boundary, project.regions.length)] })));
    set({ selectedRegionId: id, selectedTransitionId: null, activeTool: "select" }); return id;
  },
  updateRegion: (id, changes) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id ? { ...item, ...changes } : item) }))),
  updatePatternInstance: (id, changes) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id ? { ...item, pattern: { ...item.pattern, ...changes } } : item) }))),
  moveRegion: (id, dx, dy) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id && !item.locked ? { ...item, boundary: translatePoints(item.boundary, dx, dy) } : item) }))),
  resizeRegion: (id, sx, sy) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id && !item.locked ? { ...item, boundary: scalePoints(item.boundary, bounds(item.boundary), sx, sy) } : item) }))),
  rotateRegion: (id, degrees) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id && !item.locked ? { ...item, boundary: item.boundary.map((point) => rotatePoint(point, centroid(item.boundary), degrees)), pattern: { ...item.pattern, rotation: item.pattern.rotation + degrees } } : item) }))),
  updateRegionPoint: (id, pointIndex, point) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === id && !item.locked ? { ...item, boundary: item.boundary.map((current, index) => index === pointIndex ? point : current) } : item) }))),
  deleteRegion: (id) => set((state) => id === "background" ? state : ({ ...changed(state, (project) => ({ ...project, regions: project.regions.filter((item) => item.id !== id), transitions: project.transitions.filter((item) => !item.regionIds.includes(id)) })), selectedRegionId: null })),
  duplicateRegion: (id) => set((state) => changed(state, (project) => { const source = project.regions.find((item) => item.id === id); if (!source || source.id === "background") return project; const copyId = `region-${crypto.randomUUID()}`; const copy = structuredClone(source); return { ...project, regions: [...project.regions, { ...copy, id: copyId, name: `${source.name} 副本`, boundary: translatePoints(source.boundary, 12, 12), order: project.regions.length }] }; })),
  reorderRegion: (id, direction) => set((state) => changed(state, (project) => { const sorted = project.regions.toSorted((a, b) => a.order - b.order); const index = sorted.findIndex((item) => item.id === id); const target = Math.max(1, Math.min(sorted.length - 1, index + direction)); if (index <= 0 || target === index) return project; [sorted[index], sorted[target]] = [sorted[target], sorted[index]]; return { ...project, regions: sorted.map((item, order) => ({ ...item, order })) }; })),
  applyPattern: (regionId, patternId) => set((state) => changed(state, (project) => ({ ...project, canvas: regionId === "background" ? { ...project.canvas, basePatternId: patternId } : project.canvas, regions: project.regions.map((item) => item.id === regionId ? { ...item, pattern: { ...item.pattern, patternId } } : item) }))),
  updateCanvas: (width, height) => set((state) => changed(state, (project) => { const sx = width / project.canvas.width; const sy = height / project.canvas.height; return { ...project, canvas: { ...project.canvas, width, height }, regions: project.regions.map((item) => ({ ...item, boundary: scalePoints(item.boundary, { x: 0, y: 0 }, sx, sy) })), transitions: project.transitions.map((item) => ({ ...item, controlPoints: scalePoints(item.controlPoints, { x: 0, y: 0 }, sx, sy) })) }; })),
  updateCanvasConfig: (changes) => set((state) => changed(state, (project) => ({ ...project, canvas: { ...project.canvas, ...changes } }))),
  updateAppearance: (changes) => set((state) => changed(state, (project) => ({ ...project, appearance: { ...project.appearance, ...changes } }))),
  updateStrip: (regionId, id, changes) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((item) => item.id === regionId ? { ...item, pattern: { ...item.pattern, localOverrides: { ...item.pattern.localOverrides, [id]: { ...item.pattern.localOverrides[id], ...changes } } } } : item) }))),
  generateAllTransitions: (adjacencies) => set((state) => changed(state, (project) => ({ ...project, transitions: adjacencies.map(makeTransition) }))),
  addTransition: (adjacency) => set((state) => changed(state, (project) => project.transitions.some((item) => item.adjacencyId === adjacency.id) ? project : { ...project, transitions: [...project.transitions, makeTransition(adjacency, project.transitions.length)] })),
  updateTransition: (id, changes) => set((state) => changed(state, (project) => ({ ...project, transitions: project.transitions.map((item) => item.id === id ? { ...item, ...changes } : item) }))),
  deleteTransition: (id) => set((state) => ({ ...changed(state, (project) => ({ ...project, transitions: project.transitions.filter((item) => item.id !== id) })), selectedTransitionId: null })),
  undo: () => set((state) => { const previous = state.past.at(-1); return previous ? { project: snapshot(previous), past: state.past.slice(0, -1), future: [snapshot(state.project), ...state.future].slice(0, 50) } : state; }),
  redo: () => set((state) => { const next = state.future[0]; return next ? { project: snapshot(next), past: [...state.past, snapshot(state.project)].slice(-50), future: state.future.slice(1) } : state; }),
  loadProject: (project) => set((state) => ({ project: snapshot(project), past: [...state.past, snapshot(state.project)].slice(-50), future: [], selectedRegionId: null, selectedStripId: null, selectedTransitionId: null })),
  resetProject: () => set((state) => ({ project: createInitialProject(), past: [...state.past, snapshot(state.project)].slice(-50), future: [], selectedRegionId: null, selectedStripId: null, selectedTransitionId: null, activeTool: "select", zoom: 1, pan: { x: 0, y: 0 } })),
}));

export function readAutosave(): WeaveDocument | null {
  if (typeof window === "undefined") return null;
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as WeaveDocument | null; return value?.version === 2 ? value : null; } catch { return null; }
}
export function writeAutosave(project: WeaveDocument) { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }
