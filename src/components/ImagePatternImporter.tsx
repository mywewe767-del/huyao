"use client";

import { ImagePlus, Plus, Save, X } from "lucide-react";
import { useRef, useState } from "react";
import { extractDirectionLayers } from "@/engine/imageExtraction";
import { useStudioStore } from "@/store/useStudioStore";
import type { DirectionLayer, PatternDefinition } from "@/types/weave";

export function ImagePatternImporter({ onClose }: { onClose: () => void }) {
  const [imageUrl, setImageUrl] = useState(""); const [name, setName] = useState("我的图片纹样"); const [layers, setLayers] = useState<DirectionLayer[]>([]);
  const [confidence, setConfidence] = useState(0); const [busy, setBusy] = useState(false); const canvasRef = useRef<HTMLCanvasElement>(null);
  const addCustomPattern = useStudioStore((state) => state.addCustomPattern); const selectedRegionId = useStudioStore((state) => state.selectedRegionId); const applyPattern = useStudioStore((state) => state.applyPattern);
  const analyze = async (file: File) => {
    setBusy(true); const url = URL.createObjectURL(file); setImageUrl(url); const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height)); const canvas = canvasRef.current!; canvas.width = Math.max(32, Math.round(bitmap.width * scale)); canvas.height = Math.max(32, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true })!; context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); const result = extractDirectionLayers(context.getImageData(0, 0, canvas.width, canvas.height));
    setLayers(result.directionLayers); setConfidence(result.confidence); setBusy(false); bitmap.close();
  };
  const update = (id: string, changes: Partial<DirectionLayer>) => setLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...changes } : layer));
  const save = () => {
    if (layers.length < 2) return; const id = `user-pattern-${crypto.randomUUID()}`;
    const crossingRules = layers.flatMap((a, index) => layers.slice(index + 1).map((b, pairIndex) => ({ id: `${id}-cross-${index}-${pairIndex}`, directionAId: a.id, directionBId: b.id, mode: "alternate" as const })));
    const averageAngle = layers.reduce((sum, layer) => sum + layer.angle, 0) / layers.length; const openness = Math.max(.05, 1 - layers.reduce((sum, layer) => sum + layer.density, 0) / layers.length / 120);
    const pattern: PatternDefinition = { id, nameZh: name, nameEn: "Extracted Pattern", category: "decorative", description: `从图片提取 · 置信度 ${Math.round(confidence * 100)}%`, defaultDensity: 70, defaultStripWidth: layers[0].stripWidth, transitionTags: ["image-extracted", "editable"], directionLayers: layers, crossingRules, variants: [{ id: "standard", name: "标准" }, { id: "open", name: "疏织", densityMultiplier: .72 }], structure: { repeat: { width: 32, height: 32 }, directions: layers.map((layer) => layer.angle), overRule: "alternating", directionSpacing: layers.map((layer) => layer.spacing / 10), phaseOffsets: layers.map((_, index) => index % 2 ? .5 : 0) }, topology: { dominantDirections: layers.map((layer) => layer.angle), stripCountX: layers.length, stripCountY: Math.max(1, layers.length - 1), junctionTypes: layers.length > 2 ? ["multi-way"] : ["crossing"], holeTypes: ["detected"], averageAngle, crossingDensity: 1 - openness, openness, periodicity: 1 }, source: "image" };
    addCustomPattern(pattern); if (selectedRegionId) applyPattern(selectedRegionId, id); onClose();
  };
  return <div className="import-overlay" role="dialog" aria-modal="true"><div className="import-dialog"><header><div><span>PATTERN EXTRACTION MODE</span><h2>图片 → 可编辑结构</h2></div><button onClick={onClose}><X /></button></header><div className="import-body"><div className="import-preview">{imageUrl ? <img src={imageUrl} alt="待分析竹编图片" /> : <label><ImagePlus /><strong>选择竹编照片或线稿</strong><small>JPG / PNG / WEBP</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && void analyze(event.target.files[0])} /></label>}<canvas ref={canvasRef} hidden /></div><div className="import-controls"><label className="text-field"><span>纹样名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>{busy ? <p>正在检测边缘和竹条方向…</p> : layers.length ? <><p className="extraction-score">结构置信度 <strong>{Math.round(confidence * 100)}%</strong> · 可在保存前人工校正</p>{layers.map((layer, index) => <div className="extracted-layer" key={layer.id}><strong>方向 {index + 1}</strong><label>角度<input type="number" value={layer.angle} onChange={(event) => update(layer.id, { angle: Number(event.target.value) })} />°</label><label>间距<input type="number" value={Number(layer.spacing.toFixed(1))} onChange={(event) => update(layer.id, { spacing: Number(event.target.value) })} />mm</label><label>条宽<input type="number" value={Number(layer.stripWidth.toFixed(1))} onChange={(event) => update(layer.id, { stripWidth: Number(event.target.value) })} />mm</label><button onClick={() => setLayers((current) => current.filter((item) => item.id !== layer.id))}><X /></button></div>)}<button className="add-trace-layer" onClick={() => setLayers((current) => [...current, { id: `manual-${crypto.randomUUID()}`, angle: 90, spacing: 12, stripWidth: 3, stripCount: 0, density: 70, enabled: true }])}><Plus />手动补一个方向</button></> : <p>系统会执行灰度、Sobel 边缘与方向直方图分析，并输出真正的 Direction Layers。</p>}</div></div><footer><span>原图只用于分析，不会作为纹理保存。</span><button disabled={layers.length < 2} onClick={save}><Save />保存为新纹样</button></footer></div></div>;
}
