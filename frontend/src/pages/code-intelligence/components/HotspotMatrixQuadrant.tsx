import React, { useMemo } from 'react';
import type { QuadrantFileInfo, TreemapNode } from '@/types';
import { AlertOctagon, CheckCircle2, RefreshCw, Flame, Info } from 'lucide-react';

interface HotspotMatrixQuadrantProps {
  files: QuadrantFileInfo[];
  onSelectFile: (file: TreemapNode) => void;
  selectedFilePath?: string;
}

export const HotspotMatrixQuadrant: React.FC<HotspotMatrixQuadrantProps> = ({
  files,
  onSelectFile,
  selectedFilePath,
}) => {
  // Find max bounds for normalization
  const { maxChurn, maxComplexity } = useMemo(() => {
    let maxC = 10;
    let maxComp = 15;
    for (const f of files) {
      if (f.churnCount > maxC) maxC = f.churnCount;
      if (f.cyclomaticComplexity > maxComp) maxComp = f.cyclomaticComplexity;
    }
    return {
      maxChurn: Math.max(20, Math.ceil(maxC * 1.15)),
      maxComplexity: Math.max(25, Math.ceil(maxComp * 1.15)),
    };
  }, [files]);

  const complexityThreshold = 12;
  const medianChurn = useMemo(() => {
    if (!files.length) return 15;
    const sorted = [...files].map((f) => f.churnCount).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 15;
  }, [files]);

  // Convert percentages for grid positioning
  // Y-axis: Cyclomatic Complexity (0 at bottom, max at top)
  // X-axis: Churn (0 at left, max at right)
  const thresholdYPercent = (1 - complexityThreshold / maxComplexity) * 100;
  const medianXPercent = (medianChurn / maxChurn) * 100;

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Matrix Canvas Container */}
      <div className="relative w-full h-[460px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner p-6 select-none">
        {/* Background Quadrant Shading & Watermarks */}
        {/* Quadrant 1 (Top-Right): DANGER ZONE */}
        <div
          style={{
            left: `${medianXPercent}%`,
            top: 0,
            width: `${100 - medianXPercent}%`,
            height: `${thresholdYPercent}%`,
          }}
          className="absolute bg-rose-500/10 border-l border-b border-rose-500/20 p-3 pointer-events-none flex flex-col justify-between"
        >
          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <Flame className="w-4 h-4 text-rose-500" />
            <span>Danger Zone</span>
          </div>
          <span className="text-[10px] text-rose-300/60 max-w-[200px]">
            High Churn & High Complexity — Origin of ~80% of Production Outages
          </span>
        </div>

        {/* Quadrant 2 (Top-Left): STABLE COMPLEX */}
        <div
          style={{
            left: 0,
            top: 0,
            width: `${medianXPercent}%`,
            height: `${thresholdYPercent}%`,
          }}
          className="absolute bg-amber-500/5 border-b border-amber-500/20 p-3 pointer-events-none flex flex-col justify-between"
        >
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <AlertOctagon className="w-4 h-4 text-amber-500" />
            <span>Stable Complex</span>
          </div>
          <span className="text-[10px] text-amber-300/60 max-w-[180px]">
            High Complexity, Low Churn — Legacy logic; avoid unnecessary refactoring
          </span>
        </div>

        {/* Quadrant 3 (Bottom-Right): ACTIVE SIMPLE */}
        <div
          style={{
            left: `${medianXPercent}%`,
            top: `${thresholdYPercent}%`,
            width: `${100 - medianXPercent}%`,
            height: `${100 - thresholdYPercent}%`,
          }}
          className="absolute bg-blue-500/5 border-l border-blue-500/20 p-3 pointer-events-none flex flex-col justify-between"
        >
          <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <RefreshCw className="w-4 h-4 text-blue-500" />
            <span>Active Simple</span>
          </div>
          <span className="text-[10px] text-blue-300/60 max-w-[180px]">
            High Churn, Low Complexity — Well-factored frequently updated modules
          </span>
        </div>

        {/* Quadrant 4 (Bottom-Left): HEALTHY */}
        <div
          style={{
            left: 0,
            top: `${thresholdYPercent}%`,
            width: `${medianXPercent}%`,
            height: `${100 - thresholdYPercent}%`,
          }}
          className="absolute bg-emerald-500/5 p-3 pointer-events-none flex flex-col justify-between"
        >
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Healthy Baseline</span>
          </div>
          <span className="text-[10px] text-emerald-300/60 max-w-[180px]">
            Low Churn & Low Complexity — Well-structured, stable code
          </span>
        </div>

        {/* Threshold Reference Lines */}
        <div
          style={{ top: `${thresholdYPercent}%` }}
          className="absolute left-0 right-0 border-t border-dashed border-slate-600 pointer-events-none z-10"
        >
          <span className="absolute right-2 -top-4 text-[10px] font-mono text-slate-400">
            Complexity Threshold (CC = {complexityThreshold})
          </span>
        </div>
        <div
          style={{ left: `${medianXPercent}%` }}
          className="absolute top-0 bottom-0 border-l border-dashed border-slate-600 pointer-events-none z-10"
        >
          <span className="absolute -left-16 bottom-2 text-[10px] font-mono text-slate-400">
            Median Churn ({medianChurn})
          </span>
        </div>

        {/* Interactive Scatter Points */}
        {files.map((file) => {
          const xPct = Math.max(3, Math.min(96, (file.churnCount / maxChurn) * 100));
          const yPct = Math.max(5, Math.min(94, (1 - file.cyclomaticComplexity / maxComplexity) * 100));
          const isSelected = selectedFilePath === file.filePath;
          const isDanger = file.quadrant === 'DANGER_ZONE';

          // Point Color
          let pointColor = 'bg-emerald-400 border-emerald-300 text-emerald-200';
          if (file.quadrant === 'DANGER_ZONE') {
            pointColor = 'bg-rose-500 border-rose-300 text-rose-100 animate-pulse';
          } else if (file.quadrant === 'STABLE_COMPLEX') {
            pointColor = 'bg-amber-400 border-amber-300 text-amber-100';
          } else if (file.quadrant === 'ACTIVE_SIMPLE') {
            pointColor = 'bg-blue-400 border-blue-300 text-blue-100';
          }

          const fileName = file.filePath.split('/').pop() || file.filePath;

          return (
            <button
              key={file.filePath}
              type="button"
              onClick={() =>
                onSelectFile({
                  name: fileName,
                  path: file.filePath,
                  type: 'file',
                  loc: file.loc,
                  cyclomaticComplexity: file.cyclomaticComplexity,
                  cognitiveComplexity: Math.round(file.cyclomaticComplexity * 1.2),
                  defectProbability: file.defectProbability,
                  debtCount: file.debtCount,
                  churnCount: file.churnCount,
                  riskLevel: file.riskLevel as any,
                })
              }
              style={{ left: `${xPct}%`, top: `${yPct}%` }}
              title={`${file.filePath}\nComplexity: ${file.cyclomaticComplexity}\nChurn: ${file.churnCount} touches\nQuadrant: ${file.quadrant}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all z-20 cursor-pointer ${
                isSelected
                  ? 'w-6 h-6 ring-4 ring-white shadow-xl scale-125'
                  : isDanger
                  ? 'w-4 h-4 hover:scale-150'
                  : 'w-3 h-3 hover:scale-150'
              } ${pointColor}`}
            />
          );
        })}
      </div>

      {/* Axis Information Banner */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Axes:</span>
          <span>Horizontal = Commit Churn (Touches)</span>
          <span>•</span>
          <span>Vertical = Cyclomatic Complexity</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5" />
          <span>Click any node point to inspect architectural health</span>
        </div>
      </div>
    </div>
  );
};
