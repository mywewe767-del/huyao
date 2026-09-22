import type { AppearanceSettings, PatternRegion, StripGeometry, TransitionConfig } from "../types/weave";
import { spacingForDensity } from "./patternGenerator";

export interface TransitionResult { strips: StripGeometry[]; warnings: string[] }

export function generateDensityTransition(left: PatternRegion, right: PatternRegion, config: TransitionConfig, appearance: AppearanceSettings): TransitionResult {
  if (!config.enabled) return { strips: [], warnings: [] };
  const boundaryX = left.boundary[1].x;
  const top = Math.max(left.boundary[0].y, right.boundary[0].y);
  const bottom = Math.min(left.boundary[2].y, right.boundary[2].y);
  const startX = boundaryX - config.width / 2;
  const endX = boundaryX + config.width / 2;
  const averageWidth = (left.weftWidth + right.weftWidth) / 2;
  const averageSpacing = (spacingForDensity(left.density, left.weftWidth) + spacingForDensity(right.density, right.weftWidth)) / 2;
  const rows = Math.max(2, Math.floor((bottom - top) / averageSpacing));
  const strips: StripGeometry[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const t = row / rows;
    const localDensity = left.density + (right.density - left.density) * t;
    const y = top + t * (bottom - top);
    const bow = (0.5 - Math.abs(t - 0.5)) * (localDensity - (left.density + right.density) / 2) * 0.08;
    strips.push({
      id: `transition-weft-${row}`, regionId: "transition", direction: "weft",
      path: [{ x: startX, y }, { x: boundaryX, y: y + bow }, { x: endX, y }],
      width: averageWidth, color: appearance.weftColor, angle: 0, index: row,
      overUnderSequence: Array.from({ length: 24 }, (_, index) => (index + row) % 2 === 0),
    });
  }
  const columnCount = Math.max(2, Math.floor(config.width / Math.max(2, averageWidth * 1.2)));
  for (let column = 0; column <= columnCount; column += 1) {
    const t = column / columnCount;
    strips.push({
      id: `transition-warp-${column}`, regionId: "transition", direction: "warp",
      path: [{ x: startX + t * config.width, y: top }, { x: startX + t * config.width, y: bottom }],
      width: left.warpWidth + (right.warpWidth - left.warpWidth) * t,
      color: appearance.warpColor, angle: 90, index: column,
      overUnderSequence: Array.from({ length: rows + 1 }, (_, index) => (index + column) % 2 === 0),
    });
  }
  return { strips, warnings: Math.abs(left.density - right.density) > 40 ? ["密度差较大；MVP 使用线性结构过渡。"] : [] };
}
