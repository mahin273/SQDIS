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

  // Balanced quadrant dividing percentages (ensures all 4 quadrants have ample breathing room)
  const medianXPercent = 45;
  const thresholdYPercent = 52;

  const safeMedianChurn = Math.max(1, medianChurn);
  const safeMaxChurn = Math.max(safeMedianChurn + 1, maxChurn);
  const safeComplexityThreshold = complexityThreshold;
  const safeMaxComplexity = Math.max(safeComplexityThreshold + 1, maxComplexity);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Matrix Canvas Container */}
      <div className="relative w-full h-[460px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner select-none">
        {/* Background Quadrant Shading & Zone Outlines (Zero In-Canvas Text Clutter) */}
        {/* Quadrant 1 (Top-Right): DANGER ZONE */}
        <div
          style={{
            left: `${medianXPercent}%`,
            top: 0,
            width: `${100 - medianXPercent}%`,
            height: `${thresholdYPercent}%`,
          }}
          className="absolute bg-rose-500/10 border-l border-b border-rose-500/20 pointer-events-none"
        />

        {/* Quadrant 2 (Top-Left): STABLE COMPLEX */}
        <div
          style={{
            left: 0,
            top: 0,
            width: `${medianXPercent}%`,
            height: `${thresholdYPercent}%`,
          }}
          className="absolute bg-amber-500/5 border-b border-amber-500/20 pointer-events-none"
        />

        {/* Quadrant 3 (Bottom-Right): ACTIVE SIMPLE */}
        <div
          style={{
            left: `${medianXPercent}%`,
            top: `${thresholdYPercent}%`,
            width: `${100 - medianXPercent}%`,
            height: `${100 - thresholdYPercent}%`,
          }}
          className="absolute bg-blue-500/5 border-l border-blue-500/20 pointer-events-none"
        />

        {/* Quadrant 4 (Bottom-Left): HEALTHY BASELINE */}
        <div
          style={{
            left: 0,
            top: `${thresholdYPercent}%`,
            width: `${medianXPercent}%`,
            height: `${100 - thresholdYPercent}%`,
          }}
          className="absolute bg-emerald-500/5 pointer-events-none"
        />

        {/* Threshold Reference Lines with Non-Colliding Outer Badges */}
        <div
          style={{ top: `${thresholdYPercent}%` }}
          className="absolute left-0 right-0 border-t border-dashed border-slate-600/80 pointer-events-none z-10"
        >
          <span className="absolute right-3 -translate-y-1/2 text-[10px] font-mono text-slate-300 bg-slate-900/95 px-2.5 py-1 rounded-md border border-slate-700 shadow-md z-30 whitespace-nowrap">
            Complexity Threshold (CC = {complexityThreshold})
          </span>
        </div>
        <div
          style={{ left: `${medianXPercent}%` }}
          className="absolute top-0 bottom-0 border-l border-dashed border-slate-600/80 pointer-events-none z-10"
        >
          <span className="absolute -translate-x-1/2 top-3 text-[10px] font-mono text-slate-300 bg-slate-900/95 px-2.5 py-1 rounded-md border border-slate-700 shadow-md z-30 whitespace-nowrap">
            Median Churn ({medianChurn})
          </span>
        </div>

        {/* Interactive Scatter Points with Piecewise Quadrant Scaling */}
        {files.map((file) => {
          // Piecewise X-axis scaling: Churn <= median maps to [6%, medianXPercent], Churn > median maps to [medianXPercent, 94%]
          let xPct: number;
          if (file.churnCount <= safeMedianChurn) {
            const ratio = file.churnCount / safeMedianChurn;
            xPct = 6 + ratio * (medianXPercent - 6);
          } else {
            const ratio = (file.churnCount - safeMedianChurn) / (safeMaxChurn - safeMedianChurn);
            xPct = medianXPercent + ratio * (94 - medianXPercent);
          }

          // Piecewise Y-axis scaling: CC <= threshold maps to [thresholdYPercent, 94%], CC > threshold maps to [6%, thresholdYPercent]
          let yPct: number;
          if (file.cyclomaticComplexity <= safeComplexityThreshold) {
            const ratio = file.cyclomaticComplexity / safeComplexityThreshold;
            yPct = 94 - ratio * (94 - thresholdYPercent);
          } else {
            const ratio = (file.cyclomaticComplexity - safeComplexityThreshold) / (safeMaxComplexity - safeComplexityThreshold);
            yPct = thresholdYPercent - ratio * (thresholdYPercent - 6);
          }

          xPct = Math.max(5, Math.min(95, xPct));
          yPct = Math.max(6, Math.min(94, yPct));

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

      {/* 4-Card Quadrant Architectural Health Guide Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-left space-y-1">
          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>Danger Zone</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            High churn & high complexity. Primary origin of ~80% of production outages. Immediate refactoring priority.
          </p>
        </div>

        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-left space-y-1">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Stable Complex</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            High complexity, low churn. Legacy logic with low modification velocity; avoid risky or unnecessary refactoring.
          </p>
        </div>

        <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-left space-y-1">
          <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <RefreshCw className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Active Simple</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            High churn, low complexity. Well-factored, modular code updated frequently with minimal architectural risk.
          </p>
        </div>

        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-left space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Healthy Baseline</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Low churn & low complexity. Stable foundation of the codebase operating in an optimal architectural state.
          </p>
        </div>
      </div>

      {/* Axis Information Banner */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-0.5">
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
