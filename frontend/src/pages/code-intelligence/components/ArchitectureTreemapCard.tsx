import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Layers,
  Flame,
  FileCode,
  FolderTree,
  Wrench,
  RefreshCw,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { codeIntelligenceService } from '@/services';
import type { TreemapNode, RepositoryTreemapResponse, RemediationResponse } from '@/types';
import { TreemapVisualizer } from './TreemapVisualizer';
import { HotspotMatrixQuadrant } from './HotspotMatrixQuadrant';
import { RemediationAdviceModal } from '@/components/remediation';

interface ArchitectureTreemapCardProps {
  repositoryId: string;
  repositoryName?: string;
}

export const ArchitectureTreemapCard: React.FC<ArchitectureTreemapCardProps> = ({
  repositoryId,
  repositoryName,
}) => {
  const [viewMode, setViewMode] = useState<'treemap' | 'quadrant'>('treemap');
  const [sizeBy, setSizeBy] = useState<'loc' | 'churn'>('loc');
  const [colorBy, setColorBy] = useState<'complexity' | 'defectRisk' | 'debtCount'>('complexity');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<TreemapNode | null>(null);

  // Remediation modal state
  const [isRemediationOpen, setIsRemediationOpen] = useState(false);
  const [remediationData, setRemediationData] = useState<RemediationResponse | null>(null);
  const [isRemediationLoading, setIsRemediationLoading] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const treemapQuery = useQuery<RepositoryTreemapResponse>({
    queryKey: ['repository-treemap', repositoryId, sizeBy, colorBy],
    queryFn: () => codeIntelligenceService.getRepositoryTreemap(repositoryId, { sizeBy, colorBy }),
    enabled: !!repositoryId,
  });

  const data = treemapQuery.data;
  const isLoading = treemapQuery.isLoading;

  const handleOpenRemediation = async (file: TreemapNode) => {
    setIsRemediationOpen(true);
    setIsRemediationLoading(true);
    try {
      const sampleCode = `// Problematic method flagged for branching complexity (${file.cyclomaticComplexity}) in ${file.name}
function executeWorkflow(payload: any, options?: any) {
  if (payload) {
    if (payload.isActive) {
      if (!payload.isLocked) {
        if (payload.items && payload.items.length > 0) {
          for (const item of payload.items) {
            if (item.valid) {
              dispatch(item);
            }
          }
        }
      }
    }
  }
  return false;
}`;
      const res = await codeIntelligenceService.getRemediationAdvice({
        code: sampleCode,
        language: 'typescript',
        filePath: file.path,
        cyclomaticComplexity: file.cyclomaticComplexity,
      });
      setRemediationData(res);
    } catch (err) {
      console.error('Failed to fetch remediation advice for file', err);
    } finally {
      setIsRemediationLoading(false);
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-900/60 shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Repository Architecture Hotspots & Treemap
                </CardTitle>
                <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800/80 font-mono">
                  {repositoryName || 'Active Repo'}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Hierarchical codebase navigation, architectural volume, and churn vs complexity hotspot matrix.
              </CardDescription>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('treemap')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold transition-all ${
                  viewMode === 'treemap'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Treemap View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('quadrant')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold transition-all ${
                  viewMode === 'quadrant'
                    ? 'bg-white text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Quadrant Matrix</span>
              </button>
            </div>

            {/* Treemap Dimension Pickers */}
            {viewMode === 'treemap' && (
              <>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-[11px] font-medium text-slate-400">Area:</span>
                  <select
                    value={sizeBy}
                    onChange={(e) => setSizeBy(e.target.value as any)}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="loc">Lines of Code (LOC)</option>
                    <option value="churn">Commit Churn</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <span className="text-[11px] font-medium text-slate-400">Color:</span>
                  <select
                    value={colorBy}
                    onChange={(e) => setColorBy(e.target.value as any)}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="complexity">Cyclomatic Complexity</option>
                    <option value="defectRisk">Defect Risk Probability</option>
                    <option value="debtCount">Technical Debt Items</option>
                  </select>
                </div>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => treemapQuery.refetch()}
              disabled={isLoading}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
              <span className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                Total Files
              </span>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {data.totalFiles.toLocaleString()}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
              <span className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                Codebase Volume
              </span>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {data.totalLoc.toLocaleString()} LOC
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
              <span className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                Average Complexity
              </span>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {data.averageComplexity}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-rose-700 dark:text-rose-300 uppercase font-semibold tracking-wider">
                  Danger Zone
                </span>
                <Flame className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                {data.quadrantCounts.dangerZone} Hotspots
              </p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-5">
        {isLoading ? (
          <div className="w-full h-[460px] flex flex-col items-center justify-center text-slate-400 text-xs">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-2" />
            <span>Synthesizing repository architectural treemap...</span>
          </div>
        ) : !data ? (
          <div className="w-full h-[460px] flex flex-col items-center justify-center text-slate-400 text-xs">
            <FileCode className="w-8 h-8 text-slate-500 mb-2" />
            <span>No architectural telemetry available for this repository.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {viewMode === 'treemap' ? (
              <TreemapVisualizer
                rootNode={data.root}
                currentPath={currentPath}
                onNavigatePath={setCurrentPath}
                onSelectFile={setSelectedFile}
                selectedFile={selectedFile}
                sizeBy={sizeBy}
                colorBy={colorBy}
              />
            ) : (
              <HotspotMatrixQuadrant
                files={data.quadrantFiles}
                onSelectFile={setSelectedFile}
                selectedFilePath={selectedFile?.path}
              />
            )}

            {/* Selected File Inspection Flyout */}
            {selectedFile && (
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 shrink-0">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {selectedFile.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleCopyPath(selectedFile.path)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        title="Copy relative file path"
                      >
                        {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-xl">
                      {selectedFile.path}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {selectedFile.loc} LOC
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono font-semibold ${
                          selectedFile.cyclomaticComplexity >= 18
                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300'
                            : selectedFile.cyclomaticComplexity >= 10
                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        CC: {selectedFile.cyclomaticComplexity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Defect: {(selectedFile.defectProbability * 100).toFixed(0)}%
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Debt Items: {selectedFile.debtCount}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Touches: {selectedFile.churnCount}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleOpenRemediation(selectedFile)}
                    className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Remediation Advice</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Remediation Advice Modal */}
      <RemediationAdviceModal
        isOpen={isRemediationOpen}
        onClose={() => setIsRemediationOpen(false)}
        data={remediationData}
        isLoading={isRemediationLoading}
      />
    </Card>
  );
};
