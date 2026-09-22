"use client";

import { Brush, Eraser, Hand, MousePointer2, PenTool, RectangleHorizontal, Route, SlidersHorizontal, Sparkles } from "lucide-react";
import { useStudioStore } from "@/store/useStudioStore";
import type { CanvasTool } from "@/types/weave";

const tools: { id: CanvasTool; label: string; shortcut: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "选择", shortcut: "V", icon: MousePointer2 },
  { id: "direct", label: "节点选择", shortcut: "A", icon: PenTool },
  { id: "rectangle", label: "矩形区域", shortcut: "R", icon: RectangleHorizontal },
  { id: "polygon", label: "多边形区域", shortcut: "P", icon: Sparkles },
  { id: "brush", label: "画笔区域", shortcut: "B", icon: Brush },
  { id: "eraser", label: "删除区域", shortcut: "E", icon: Eraser },
  { id: "transition", label: "过渡工具", shortcut: "L", icon: Route },
  { id: "gradient", label: "密度渐变", shortcut: "G", icon: SlidersHorizontal },
  { id: "pan", label: "平移画布", shortcut: "H", icon: Hand },
];

export function ToolRail() {
  const activeTool = useStudioStore((state) => state.activeTool);
  const setActiveTool = useStudioStore((state) => state.setActiveTool);
  return <nav className="tool-rail" aria-label="画布工具">{tools.map((tool) => <button key={tool.id} className={activeTool === tool.id ? "active" : ""} title={`${tool.label} (${tool.shortcut})`} onClick={() => setActiveTool(tool.id)}><tool.icon /><span>{tool.shortcut}</span></button>)}</nav>;
}
