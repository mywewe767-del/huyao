"use client";

import { Download, FileDown, Focus, FolderOpen, Redo2, RotateCcw, Save, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useRef } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { exportJson, exportPng, loadJsonFile } from "@/utils/exportProject";

function ToolButton({ label, title, disabled, onClick, children }: { label?: string; title: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className="tool-button" title={title} aria-label={title} disabled={disabled} onClick={onClick}>{children}{label ? <span>{label}</span> : null}</button>;
}

export function TopToolbar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { project, undo, redo, past, future, zoom, setZoom, fitView, loadProject, resetProject, setToast } = useStudioStore();
  const onLoad = async (file?: File) => {
    if (!file) return;
    try { loadProject(await loadJsonFile(file)); setToast("项目已读取"); } catch (error) { setToast(error instanceof Error ? error.message : "读取失败"); }
  };
  const onPng = async () => {
    try { await exportPng(project); setToast("PNG 已导出"); } catch (error) { setToast(error instanceof Error ? error.message : "导出失败"); }
  };
  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark">竹</span><div><strong>Bamboo Weave</strong><small>STUDIO · MVP</small></div></div>
      <div className="document-title"><span className="save-dot" />{project.name}<small>{project.canvas.width} × {project.canvas.height} mm</small></div>
      <nav className="toolbar" aria-label="编辑工具栏">
        <div className="tool-group"><ToolButton title="撤销 (Ctrl+Z)" disabled={!past.length} onClick={undo}><Undo2 /></ToolButton><ToolButton title="重做 (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}><Redo2 /></ToolButton></div>
        <div className="tool-group zoom-group"><ToolButton title="缩小" onClick={() => setZoom(zoom - 0.1)}><ZoomOut /></ToolButton><span>{Math.round(zoom * 100)}%</span><ToolButton title="放大" onClick={() => setZoom(zoom + 0.1)}><ZoomIn /></ToolButton><ToolButton title="适合画面" onClick={fitView}><Focus /></ToolButton></div>
        <div className="tool-group">
          <ToolButton title="新建样板" onClick={resetProject}><RotateCcw /></ToolButton>
          <ToolButton title="读取项目" onClick={() => inputRef.current?.click()}><FolderOpen /></ToolButton>
          <input ref={inputRef} hidden type="file" accept=".json,.bamboo.json,application/json" onChange={(event) => void onLoad(event.target.files?.[0])} />
          <ToolButton title="保存 JSON" onClick={() => { exportJson(project); setToast("项目 JSON 已保存"); }}><Save /></ToolButton>
        </div>
        <button className="export-button" onClick={() => void onPng()}><Download /><span>导出 PNG</span></button>
      </nav>
      <FileDown className="mobile-file-icon" />
    </header>
  );
}
