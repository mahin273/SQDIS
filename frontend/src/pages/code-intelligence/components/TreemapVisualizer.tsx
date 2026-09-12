import React, { useMemo } from 'react';
import type { TreemapNode } from '@/types';
import { Folder, FileCode, ChevronRight } from 'lucide-react';

interface TreemapVisualizerProps {
  rootNode: TreemapNode;
  currentPath: string;
  onNavigatePath: (path: string) => void;
  onSelectFile: (file: TreemapNode) => void;
  selectedFile: TreemapNode | null;
  sizeBy: 'loc' | 'churn';
  colorBy: 'complexity' | 'defectRisk' | 'debtCount';
}

interface RectLayout {
  node: TreemapNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TreemapVisualizer: React.FC<TreemapVisualizerProps> = ({
  rootNode,
  currentPath,
  onNavigatePath,
  onSelectFile,
  selectedFile,
  sizeBy,
  colorBy,
}) => {
  // Find current directory node matching currentPath
  const currentNode = useMemo(() => {
    if (!currentPath || currentPath === '' || currentPath === 'root') {
      return rootNode;
    }
    const parts = currentPath.split('/').filter(Boolean);
    let curr = rootNode;
    for (const part of parts) {
      if (curr.children) {
        const next = curr.children.find((c) => c.name === part);
        if (next) curr = next;
      }
    }
    return curr;
  }, [rootNode, currentPath]);

  // Compute layout for immediate children using 2D slice-and-dice partitioning
  const children = currentNode.children || [];

  const rects: RectLayout[] = useMemo(() => {
    if (!children.length) return [];

    const width = 100; // Percentage basis
    const height = 100;

    const getNodeWeight = (node: TreemapNode) => {
      const val = sizeBy === 'churn' ? node.churnCount : node.loc;
      return Math.max(1, val);
    };

    const totalWeight = children.reduce((acc, c) => acc + getNodeWeight(c), 0);
    if (totalWeight <= 0) return [];

    // Aspect-ratio partitioning algorithm (alternating vertical/horizontal slices)
    const layouts: RectLayout[] = [];

    let currentX = 0;
    let currentY = 0;
    let remainingWidth = width;
    let remainingHeight = height;

    // Sort descending by weight
    const sorted = [...children].sort((a, b) => getNodeWeight(b) - getNodeWeight(a));

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const remainingItems = sorted.slice(i);
      const subTotal = remainingItems.reduce((acc, c) => acc + getNodeWeight(c), 0);
      const fraction = getNodeWeight(item) / (subTotal || 1);

      if (remainingWidth >= remainingHeight) {
        // Slice along width
        const w = i === sorted.length - 1 ? remainingWidth : remainingWidth * fraction;
        layouts.push({
          node: item,
          x: currentX,
          y: currentY,
          w: Math.max(1, Math.min(remainingWidth, w)),
          h: remainingHeight,
        });
        currentX += w;
        remainingWidth -= w;
      } else {
        // Slice along height
        const h = i === sorted.length - 1 ? remainingHeight : remainingHeight * fraction;
        layouts.push({
          node: item,
          x: currentX,
          y: currentY,
          w: remainingWidth,
          h: Math.max(1, Math.min(remainingHeight, h)),
        });
        currentY += h;
        remainingHeight -= h;
      }
    }

    return layouts;
  }, [children, sizeBy]);

  // Color generator based on selected metric
  const getNodeColor = (node: TreemapNode) => {
    if (colorBy === 'complexity') {
      const cc = node.cyclomaticComplexity;
      if (cc >= 18) {
        return {
          bg: 'bg-rose-500/20 hover:bg-rose-500/30 dark:bg-rose-950/40 dark:hover:bg-rose-900/50',
          border: 'border-rose-400 dark:border-rose-600',
          text: 'text-rose-700 dark:text-rose-300',
          badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200',
        };
      }
      if (cc >= 10) {
        return {
          bg: 'bg-amber-500/20 hover:bg-amber-500/30 dark:bg-amber-950/40 dark:hover:bg-amber-900/50',
          border: 'border-amber-400 dark:border-amber-600',
          text: 'text-amber-700 dark:text-amber-300',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200',
        };
      }
      return {
        bg: 'bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40',
        border: 'border-emerald-400 dark:border-emerald-600',
        text: 'text-emerald-700 dark:text-emerald-300',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200',
      };
    }

    if (colorBy === 'defectRisk') {
      const p = node.defectProbability;
      if (p >= 0.6) {
        return {
          bg: 'bg-rose-500/20 hover:bg-rose-500/30 dark:bg-rose-950/40 dark:hover:bg-rose-900/50',
          border: 'border-rose-400 dark:border-rose-600',
          text: 'text-rose-700 dark:text-rose-300',
          badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200',
        };
      }
      if (p >= 0.3) {
        return {
          bg: 'bg-amber-500/20 hover:bg-amber-500/30 dark:bg-amber-950/40 dark:hover:bg-amber-900/50',
          border: 'border-amber-400 dark:border-amber-600',
          text: 'text-amber-700 dark:text-amber-300',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200',
        };
      }
      return {
        bg: 'bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40',
        border: 'border-emerald-400 dark:border-emerald-600',
        text: 'text-emerald-700 dark:text-emerald-300',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200',
      };
    }

    // Default: debtCount
    const debt = node.debtCount;
    if (debt >= 4) {
      return {
        bg: 'bg-rose-500/20 hover:bg-rose-500/30 dark:bg-rose-950/40 dark:hover:bg-rose-900/50',
        border: 'border-rose-400 dark:border-rose-600',
        text: 'text-rose-700 dark:text-rose-300',
        badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200',
      };
    }
    if (debt >= 1) {
      return {
        bg: 'bg-amber-500/20 hover:bg-amber-500/30 dark:bg-amber-950/40 dark:hover:bg-amber-900/50',
        border: 'border-amber-400 dark:border-amber-600',
        text: 'text-amber-700 dark:text-amber-300',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200',
      };
    }
    return {
      bg: 'bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40',
      border: 'border-emerald-400 dark:border-emerald-600',
      text: 'text-emerald-700 dark:text-emerald-300',
      badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200',
    };
  };

  // Breadcrumbs path parser
  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Root', path: '' }];
    let acc = '';
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      crumbs.push({ name: p, path: acc });
    }
    return crumbs;
  }, [currentPath]);

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Interactive Breadcrumb Bar */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1 shrink-0">Path:</span>
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.path || 'root'}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <button
                type="button"
                onClick={() => onNavigatePath(crumb.path)}
                disabled={isLast}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors shrink-0 ${
                  isLast
                    ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {idx === 0 ? <Folder className="w-3.5 h-3.5" /> : null}
                <span>{crumb.name}</span>
              </button>
            </React.Fragment>
          );
        })}
        {currentNode.children && currentNode.children.length > 0 && (
          <span className="ml-auto text-[11px] text-slate-400 shrink-0">
            {currentNode.children.length} {currentNode.children.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {/* Main Treemap Canvas Container */}
      <div className="relative w-full h-[460px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner p-1.5">
        {rects.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
            <FileCode className="w-8 h-8 text-slate-600 mb-2" />
            <span>This directory has no further submodules.</span>
          </div>
        ) : (
          rects.map(({ node, x, y, w, h }) => {
            const colors = getNodeColor(node);
            const isSelected = selectedFile?.path === node.path;
            const isDir = node.type === 'directory';

            return (
              <div
                key={node.path}
                onClick={() => {
                  if (isDir) {
                    onNavigatePath(node.path);
                  } else {
                    onSelectFile(node);
                  }
                }}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${w}%`,
                  height: `${h}%`,
                }}
                title={`${node.name} (${isDir ? 'Directory' : 'File'})\nLOC: ${node.loc}\nCyclomatic: ${node.cyclomaticComplexity}\nDefect Prob: ${(node.defectProbability * 100).toFixed(0)}%\nDebt Items: ${node.debtCount}\nTouches: ${node.churnCount}`}
                className={`absolute p-1.5 transition-all duration-200 cursor-pointer overflow-hidden group ${
                  isSelected ? 'z-20' : 'z-10'
                }`}
              >
                <div
                  className={`w-full h-full rounded-lg border flex flex-col justify-between p-2 text-left transition-all ${
                    colors.bg
                  } ${colors.border} ${
                    isSelected
                      ? 'ring-2 ring-blue-500 shadow-lg scale-[0.98]'
                      : 'hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-md'
                  }`}
                >
                  {/* Top Bar: Icon + Name */}
                  <div className="flex items-start justify-between gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isDir ? (
                        <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:text-blue-400 transition-colors" />
                      ) : (
                        <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:text-indigo-400 transition-colors" />
                      )}
                      <span className="text-xs font-semibold text-slate-100 truncate tracking-tight">
                        {node.name}
                      </span>
                    </div>

                    {isDir && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-1 py-0.2 rounded border border-slate-700/50 shrink-0">
                        {node.children?.length ?? 0}
                      </span>
                    )}
                  </div>

                  {/* Middle / Bottom Stats: Only show if rectangle is large enough */}
                  {w > 12 && h > 14 && (
                    <div className="flex items-end justify-between text-[11px] mt-1 pt-1 border-t border-slate-800/40">
                      <span className="text-slate-400 font-mono text-[10px]">
                        {sizeBy === 'churn' ? `${node.churnCount} touches` : `${node.loc} LOC`}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${colors.badge}`}
                      >
                        {colorBy === 'complexity'
                          ? `CC ${node.cyclomaticComplexity}`
                          : colorBy === 'defectRisk'
                          ? `${(node.defectProbability * 100).toFixed(0)}% Risk`
                          : `${node.debtCount} Debt`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Spectrum:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Low / Healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Elevated Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Critical Hotspot</span>
          </div>
        </div>

        <span className="text-slate-400 italic">
          Tip: Click folders to drill down; click any file to inspect.
        </span>
      </div>
    </div>
  );
};
