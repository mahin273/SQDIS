import React, { useMemo, useState, useRef, useEffect } from 'react';
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
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  w: number; // percentage 0..100
  h: number; // percentage 0..100
}

interface ScaledNode {
  node: TreemapNode;
  area: number;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);
  const containerHeight = 460; // Matches h-[460px] canvas

  // Observe container width to calculate real-world aspect ratios
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const clientW = containerRef.current.clientWidth;
        if (clientW > 0) setContainerWidth(clientW);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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

  const children = currentNode.children || [];

  // =========================================================================
  // BRULS-HUIZING-VAN WIJK SQUARIFIED TREEMAP ALGORITHM
  // =========================================================================
  const rects: RectLayout[] = useMemo(() => {
    if (!children.length) return [];

    const getNodeWeight = (node: TreemapNode) => {
      const val = sizeBy === 'churn' ? node.churnCount : node.loc;
      return Math.max(1, val);
    };

    // Sort descending by weight for optimal packing
    const sorted = [...children].sort((a, b) => getNodeWeight(b) - getNodeWeight(a));
    const totalWeight = sorted.reduce((acc, c) => acc + getNodeWeight(c), 0);
    if (totalWeight <= 0) return [];

    const totalArea = containerWidth * containerHeight;
    const scaledItems: ScaledNode[] = sorted.map((node) => ({
      node,
      area: (getNodeWeight(node) / totalWeight) * totalArea,
    }));

    const layouts: RectLayout[] = [];

    // Helper: Worst aspect ratio in row along target dimension w
    const worst = (row: ScaledNode[], w: number): number => {
      if (row.length === 0 || w <= 0) return Infinity;
      const s = row.reduce((acc, c) => acc + c.area, 0);
      if (s <= 0) return Infinity;
      const w2 = w * w;
      const s2 = s * s;
      let maxRatio = 0;
      for (const item of row) {
        const r1 = (w2 * item.area) / s2;
        const r2 = s2 / (w2 * item.area);
        const ratio = Math.max(r1, r2);
        if (ratio > maxRatio) maxRatio = ratio;
      }
      return maxRatio;
    };

    // Helper: Lay out a finalized row into rectangular partitions
    const layoutRow = (
      row: ScaledNode[],
      w: number,
      x: number,
      y: number,
      wRem: number,
      hRem: number
    ) => {
      const s = row.reduce((acc, c) => acc + c.area, 0);
      const rowThickness = w > 0 ? s / w : 0;
      const isHorizontal = wRem <= hRem;
      let offset = 0;

      for (const item of row) {
        const itemLength = rowThickness > 0 ? item.area / rowThickness : 0;
        let rx: number;
        let ry: number;
        let rw: number;
        let rh: number;

        if (isHorizontal) {
          rx = x + offset;
          ry = y;
          rw = itemLength;
          rh = rowThickness;
          offset += itemLength;
        } else {
          rx = x;
          ry = y + offset;
          rw = rowThickness;
          rh = itemLength;
          offset += itemLength;
        }

        // Convert to percentage coordinates clamped strictly to [0..100]
        const px = Math.max(0, Math.min(100, (rx / containerWidth) * 100));
        const py = Math.max(0, Math.min(100, (ry / containerHeight) * 100));
        const pw = Math.max(0, Math.min(100 - px, (rw / containerWidth) * 100));
        const ph = Math.max(0, Math.min(100 - py, (rh / containerHeight) * 100));

        layouts.push({
          node: item.node,
          x: px,
          y: py,
          w: pw,
          h: ph,
        });
      }

      if (isHorizontal) {
        const newY = y + rowThickness;
        const newHRem = Math.max(0, hRem - rowThickness);
        const newWRem = wRem;
        const nextW = Math.min(newWRem, newHRem);
        return { newX: x, newY, newWRem, newHRem, nextW };
      } else {
        const newX = x + rowThickness;
        const newWRem = Math.max(0, wRem - rowThickness);
        const newHRem = hRem;
        const nextW = Math.min(newWRem, newHRem);
        return { newX, newY: y, newWRem, newHRem, nextW };
      }
    };

    // Recursive squarification loop
    const squarifyRec = (
      items: ScaledNode[],
      currentRow: ScaledNode[],
      w: number,
      x: number,
      y: number,
      wRem: number,
      hRem: number
    ) => {
      if (items.length === 0) {
        if (currentRow.length > 0) {
          layoutRow(currentRow, w, x, y, wRem, hRem);
        }
        return;
      }

      const nextItem = items[0];
      const testRow = [...currentRow, nextItem];

      if (currentRow.length === 0 || worst(currentRow, w) >= worst(testRow, w)) {
        squarifyRec(items.slice(1), testRow, w, x, y, wRem, hRem);
      } else {
        const updated = layoutRow(currentRow, w, x, y, wRem, hRem);
        squarifyRec(items, [], updated.nextW, updated.newX, updated.newY, updated.newWRem, updated.newHRem);
      }
    };

    const initialW = Math.min(containerWidth, containerHeight);
    squarifyRec(scaledItems, [], initialW, 0, 0, containerWidth, containerHeight);

    return layouts;
  }, [children, sizeBy, containerWidth, containerHeight]);

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
      <div
        ref={containerRef}
        className="relative w-full h-[460px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner p-1"
      >
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

            // Adaptive sizing tiers in percentage terms
            // w% on 1000px: 10% = 100px. h% on 460px: 10% = 46px
            const isComfortable = w >= 8 && h >= 14; // Large enough for icon, name, badge, and bottom stats
            const isCompact = w >= 5 && h >= 6; // Fits single row of icon + truncated name
            const showCountBadge = w >= 8 && isDir && node.children && node.children.length > 0;

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
                className={`absolute p-1 transition-all duration-200 cursor-pointer overflow-hidden group ${
                  isSelected ? 'z-20' : 'z-10'
                }`}
              >
                <div
                  className={`w-full h-full rounded-lg border text-left transition-all overflow-hidden flex ${
                    isComfortable
                      ? 'flex-col justify-between p-2'
                      : isCompact
                      ? 'flex-row items-center justify-between px-2 py-1'
                      : 'items-center justify-center p-0.5'
                  } ${colors.bg} ${colors.border} ${
                    isSelected
                      ? 'ring-2 ring-blue-500 shadow-lg scale-[0.98]'
                      : 'hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-md'
                  }`}
                >
                  {/* Primary Row: Icon + Name */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    {isDir ? (
                      <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:text-blue-400 transition-colors" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:text-indigo-400 transition-colors" />
                    )}

                    {isCompact && (
                      <span className="text-xs font-semibold text-slate-100 truncate tracking-tight min-w-0 flex-1">
                        {node.name}
                      </span>
                    )}
                  </div>

                  {/* Child Count Badge (Only rendered when width allows) */}
                  {showCountBadge && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900/70 px-1 py-0.2 rounded border border-slate-700/60 shrink-0 ml-1">
                      {node.children?.length ?? 0}
                    </span>
                  )}

                  {/* Secondary Metric Strip (Only rendered on comfortable tiles) */}
                  {isComfortable && (
                    <div className="flex items-end justify-between text-[11px] mt-1 pt-1 border-t border-slate-800/40 w-full overflow-hidden">
                      <span className="text-slate-400 font-mono text-[10px] truncate max-w-[50%]">
                        {sizeBy === 'churn' ? `${node.churnCount} touches` : `${node.loc} LOC`}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${colors.badge}`}
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
