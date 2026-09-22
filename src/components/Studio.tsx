"use client";

import dynamic from "next/dynamic";
import { Box, Check, CircleDot, Grid3X3, Save, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { PatternLibrary } from "./PatternLibrary";
import { PropertyPanel } from "./PropertyPanel";
import { TopToolbar } from "./TopToolbar";
import { WeaveCanvas } from "./WeaveCanvas";
import { ToolRail } from "./ToolRail";
import { readAutosave, useStudioStore, writeAutosave } from "@/store/useStudioStore";

const ThreePreview = dynamic(() => import("./ThreePreview"), { ssr: false, loading: () => <div className="preview-loading"><Sparkles />正在构建 3D 竹条…</div> });

export function Studio() {
  const { project, viewMode, setViewMode, undo, redo, loadProject, toast, setToast } = useStudioStore();
  const hydrated = useRef(false);
  useEffect(() => {
    const saved = readAutosave();
    if (saved) loadProject(saved);
    hydrated.current = true;
  }, [loadProject]);
  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => writeAutosave(project), 350);
    return () => window.clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast, setToast]);
  return (
    <main className="studio-shell">
      <TopToolbar />
      <div className="workspace">
        <ToolRail />
        <PatternLibrary />
        <section className="center-workspace">
          <div className="canvas-toolbar">
            <div><CircleDot /><span>可编辑画板</span><small>滚轮缩放 · Space 拖动 · R/P/B 创建区域</small></div>
            <div className="canvas-legend"><span><i className="warp-dot" />方向组 A</span><span><i className="weft-dot" />方向组 B+</span><span><i className="over-dot" />上穿节点</span></div>
          </div>
          <div className="viewport">{viewMode === "2d" ? <WeaveCanvas /> : <ThreePreview />}</div>
          <footer className="viewbar">
            <div className="view-tabs"><button className={viewMode === "2d" ? "active" : ""} onClick={() => setViewMode("2d")}><Grid3X3 />2D Structure</button><button className={viewMode === "3d" ? "active" : ""} onClick={() => setViewMode("3d")}><Box />3D Realistic</button></div>
            <div className="status-items"><span><Check />自动保存</span><span><Save />{Math.max(0, project.regions.length - 1)} 个设计区域 · {project.transitions.length} 个过渡</span></div>
          </footer>
        </section>
        <PropertyPanel />
      </div>
      {toast ? <div className="toast"><Check />{toast}</div> : null}
    </main>
  );
}
