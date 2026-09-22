import type { WeaveDocument } from "@/types/weave";

function download(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

export function exportJson(project: WeaveDocument) {
  download(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${project.name || "bamboo-design"}.bamboo.json`);
}

export async function exportPng(project: WeaveDocument) {
  const source = document.getElementById("bamboo-structure-svg") as SVGSVGElement | null;
  if (!source) throw new Error("请先切换到 2D 结构视图");
  const svg = source.cloneNode(true) as SVGSVGElement;
  svg.querySelectorAll("[data-export-ignore]").forEach((node) => node.remove());
  svg.setAttribute("width", String(project.canvas.width * 4));
  svg.setAttribute("height", String(project.canvas.height * 4));
  const serialized = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("无法渲染导出图像"));
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = project.canvas.width * 4;
  canvas.height = project.canvas.height * 4;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持 Canvas 导出");
  context.fillStyle = "#f7f2e8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG 生成失败");
  download(blob, `${project.name || "bamboo-design"}.png`);
}

export function loadJsonFile(file: File): Promise<WeaveDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = JSON.parse(String(reader.result)) as WeaveDocument;
        if (project.version !== 2 || !Array.isArray(project.regions)) throw new Error("不支持的项目文件，请使用 V2 JSON");
        resolve(project);
      } catch (error) { reject(error); }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}
