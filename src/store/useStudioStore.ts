import { create } from "zustand";
import type { BambooProject, Direction, PatternRegion } from "@/types/weave";

const STORAGE_KEY = "bamboo-weave-studio:v1";

function makeRegion(id: string, name: string, patternId: string, x0: number, x1: number, height: number): PatternRegion {
  return {
    id, name, patternId, rotation: 0, density: patternId === "plain" ? 72 : 58,
    warpWidth: 5, weftWidth: 4, materialId: "natural-bamboo",
    boundary: [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: height }, { x: x0, y: height }],
  };
}

export function createInitialProject(): BambooProject {
  return {
    version: 1, name: "未命名竹编设计",
    canvas: { width: 300, height: 200, gridSize: 10 },
    regions: [makeRegion("region-left", "左侧区域", "plain", 0, 150, 200), makeRegion("region-right", "右侧区域", "diamond", 150, 300, 200)],
    transition: { enabled: false, width: 40, strategy: "structural" },
    appearance: {
      globalColor: "#c9a96e", warpColor: "#d6b879", weftColor: "#8ca66b", thickness: 1.2, stripOverrides: {},
    },
    updatedAt: new Date().toISOString(),
  };
}

interface StudioState {
  project: BambooProject;
  past: BambooProject[];
  future: BambooProject[];
  selectedPatternId: string;
  selectedRegionId: string | null;
  selectedStripId: string | null;
  selectedDirection: Direction | "all";
  viewMode: "2d" | "3d";
  zoom: number;
  toast: string | null;
  setSelectedPattern: (id: string) => void;
  selectRegion: (id: string | null) => void;
  selectStrip: (id: string | null) => void;
  setDirection: (direction: Direction | "all") => void;
  setViewMode: (mode: "2d" | "3d") => void;
  setZoom: (zoom: number) => void;
  setToast: (message: string | null) => void;
  applyPattern: (regionId: string, patternId: string) => void;
  updateRegion: (id: string, changes: Partial<PatternRegion>) => void;
  resizeBoundary: (x: number) => void;
  updateCanvas: (width: number, height: number) => void;
  updateAppearance: (changes: Partial<BambooProject["appearance"]>) => void;
  updateStrip: (id: string, changes: { color?: string; width?: number }) => void;
  updateTransition: (changes: Partial<BambooProject["transition"]>) => void;
  undo: () => void;
  redo: () => void;
  loadProject: (project: BambooProject) => void;
  resetProject: () => void;
}

function snapshot(project: BambooProject): BambooProject {
  return structuredClone(project);
}

function changed(state: StudioState, recipe: (project: BambooProject) => BambooProject): Partial<StudioState> {
  const next = recipe(snapshot(state.project));
  next.updatedAt = new Date().toISOString();
  return { project: next, past: [...state.past.slice(-49), snapshot(state.project)], future: [] };
}

export const useStudioStore = create<StudioState>((set) => ({
  project: createInitialProject(), past: [], future: [], selectedPatternId: "plain", selectedRegionId: "region-left",
  selectedStripId: null, selectedDirection: "all", viewMode: "2d", zoom: 1, toast: null,
  setSelectedPattern: (id) => set({ selectedPatternId: id }),
  selectRegion: (id) => set({ selectedRegionId: id, selectedStripId: null }),
  selectStrip: (id) => set({ selectedStripId: id }),
  setDirection: (direction) => set({ selectedDirection: direction }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setZoom: (zoom) => set({ zoom: Math.max(0.6, Math.min(1.8, zoom)) }),
  setToast: (message) => set({ toast: message }),
  applyPattern: (regionId, patternId) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((region) => region.id === regionId ? { ...region, patternId } : region) }))),
  updateRegion: (id, changes) => set((state) => changed(state, (project) => ({ ...project, regions: project.regions.map((region) => region.id === id ? { ...region, ...changes } : region) }))),
  resizeBoundary: (rawX) => set((state) => changed(state, (project) => {
    const x = Math.max(40, Math.min(project.canvas.width - 40, rawX));
    const [left, right] = project.regions;
    return { ...project, regions: [
      { ...left, boundary: [{ x: 0, y: 0 }, { x, y: 0 }, { x, y: project.canvas.height }, { x: 0, y: project.canvas.height }] },
      { ...right, boundary: [{ x, y: 0 }, { x: project.canvas.width, y: 0 }, { x: project.canvas.width, y: project.canvas.height }, { x, y: project.canvas.height }] },
    ] };
  })),
  updateCanvas: (width, height) => set((state) => changed(state, (project) => {
    const oldSplit = project.regions[0].boundary[1].x / project.canvas.width;
    const split = width * oldSplit;
    return { ...project, canvas: { ...project.canvas, width, height }, regions: [
      { ...project.regions[0], boundary: [{ x: 0, y: 0 }, { x: split, y: 0 }, { x: split, y: height }, { x: 0, y: height }] },
      { ...project.regions[1], boundary: [{ x: split, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: split, y: height }] },
    ] };
  })),
  updateAppearance: (changes) => set((state) => changed(state, (project) => ({ ...project, appearance: { ...project.appearance, ...changes } }))),
  updateStrip: (id, changes) => set((state) => changed(state, (project) => ({
    ...project, appearance: { ...project.appearance, stripOverrides: { ...project.appearance.stripOverrides, [id]: { ...project.appearance.stripOverrides[id], ...changes } } },
  }))),
  updateTransition: (changes) => set((state) => changed(state, (project) => ({ ...project, transition: { ...project.transition, ...changes } }))),
  undo: () => set((state) => {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { project: snapshot(previous), past: state.past.slice(0, -1), future: [snapshot(state.project), ...state.future].slice(0, 50) };
  }),
  redo: () => set((state) => {
    const next = state.future[0];
    if (!next) return state;
    return { project: snapshot(next), past: [...state.past, snapshot(state.project)].slice(-50), future: state.future.slice(1) };
  }),
  loadProject: (project) => set((state) => ({ project: snapshot(project), past: [...state.past, snapshot(state.project)].slice(-50), future: [], selectedRegionId: project.regions[0]?.id ?? null, selectedStripId: null })),
  resetProject: () => set((state) => ({ project: createInitialProject(), past: [...state.past, snapshot(state.project)].slice(-50), future: [], selectedRegionId: "region-left", selectedStripId: null })),
}));

export function readAutosave(): BambooProject | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as BambooProject | null; } catch { return null; }
}

export function writeAutosave(project: BambooProject) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}
