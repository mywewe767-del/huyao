import type { DirectionLayer } from "@/types/weave";

export interface ImageExtractionResult { directionLayers: DirectionLayer[]; confidence: number; edgeDensity: number }

const angularDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 180 - Math.abs(a - b));

export function extractDirectionLayers(image: ImageData): ImageExtractionResult {
  const { width, height, data } = image; const gray = new Float32Array(width * height);
  for (let index = 0; index < gray.length; index += 1) gray[index] = data[index * 4] * .299 + data[index * 4 + 1] * .587 + data[index * 4 + 2] * .114;
  const bins = new Float64Array(36); let edgeSum = 0; let strongEdges = 0;
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const i = y * width + x;
    const gx = -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] + gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
    const gy = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
    const magnitude = Math.hypot(gx, gy); if (magnitude < 70) continue;
    // Gradient is perpendicular to the strip center line.
    const stripAngle = ((Math.atan2(gy, gx) * 180 / Math.PI + 90) % 180 + 180) % 180;
    bins[Math.floor(stripAngle / 5) % bins.length] += magnitude; edgeSum += magnitude; strongEdges += 1;
  }
  const candidates = Array.from(bins, (score, index) => ({ angle: index * 5 + 2.5, score })).sort((a, b) => b.score - a.score);
  const peaks: typeof candidates = [];
  for (const candidate of candidates) { if (candidate.score <= 0 || peaks.some((peak) => angularDistance(peak.angle, candidate.angle) < 18)) continue; peaks.push(candidate); if (peaks.length === 4) break; }
  const edgeDensity = strongEdges / Math.max(1, (width - 2) * (height - 2)); const maxScore = candidates[0]?.score || 1;
  const directionLayers = peaks.map((peak, index): DirectionLayer => {
    const relative = peak.score / maxScore; const spacing = Math.max(5, Math.min(28, 18 - edgeDensity * 45 + index * 1.5));
    return { id: `image-direction-${crypto.randomUUID()}`, angle: Math.round(peak.angle), spacing, stripWidth: Math.max(2, spacing * (.22 + edgeDensity * .5)), stripCount: 0, density: Math.round(45 + relative * 45), enabled: true };
  });
  if (directionLayers.length < 2) directionLayers.push({ id: `image-direction-${crypto.randomUUID()}`, angle: ((directionLayers[0]?.angle ?? 0) + 90) % 180, spacing: 12, stripWidth: 3, stripCount: 0, density: 65, enabled: true });
  return { directionLayers, confidence: Math.min(.96, .35 + edgeDensity * 3 + peaks.length * .1), edgeDensity };
}
