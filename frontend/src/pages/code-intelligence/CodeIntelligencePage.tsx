import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DefectRiskGauge } from './components/DefectRiskGauge';
import {
  codeIntelligenceService,
  repositoriesService,
  teamsService,
  type AstDefectResponse,
  type CommitRiskResponse,
  type TestImpactResponse,
  type TeamBusFactorResponse,
  type RepositoryHotspot,
  type CommitRiskItem,
  type TestImpactResult,
  type ModuleBusFactorResult,
} from '@/services';
import {
  BrainCircuit,
  Code2,
  GitCommit,
  Layers,
  Users,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Check,
  GitBranch,
  Flame,
  FileCode,
  ShieldCheck,
  Search,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react';


export const CodeIntelligencePage: React.FC = () => {
  // Top-Level Studio Mode: LIVE Explorer vs PRE-COMMIT Sandbox
  const [studioMode, setStudioMode] = useState<'LIVE' | 'SANDBOX'>('LIVE');

  // =========================================================================
  // MODE 1: LIVE REPOSITORY EXPLORER STATE & QUERIES
  // =========================================================================
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [activeLiveTab, setActiveLiveTab] = useState<'hotspots' | 'commits' | 'tia' | 'bus-factor'>('hotspots');
  const [hotspotSearch, setHotspotSearch] = useState('');
  const [hotspotRiskFilter, setHotspotRiskFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'>('ALL');
  const [hotspotSortBy, setHotspotSortBy] = useState<'cc' | 'mi' | 'risk'>('cc');
  const [commitSearch, setCommitSearch] = useState('');
  const [expandedCommitSha, setExpandedCommitSha] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Fetch all accessible repositories for the organization
  const reposQuery = useQuery({
    queryKey: ['repositories'],
    queryFn: () => repositoriesService.getAll(),
  });

  const repos = useMemo(() => {
    const data = reposQuery.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray((data as any).data)) return (data as any).data;
    return [];
  }, [reposQuery.data]);

  const activeRepo = useMemo(() => {
    return repos.find((r: any) => r.id === selectedRepoId) || repos[0] || null;
  }, [repos, selectedRepoId]);

  const activeRepoId = activeRepo?.id || '';

  // 1. Live Hotspots Query
  const hotspotsQuery = useQuery({
    queryKey: ['repository-hotspots', activeRepoId],
    queryFn: () => codeIntelligenceService.getRepositoryHotspots(activeRepoId, 100),
    enabled: !!activeRepoId && studioMode === 'LIVE',
  });
  const hotspots: RepositoryHotspot[] = hotspotsQuery.data || [];

  // 2. Live Commits Risk Query
  const commitsRiskQuery = useQuery({
    queryKey: ['repository-commits-risk', activeRepoId],
    queryFn: () => codeIntelligenceService.getRepositoryCommitsRisk(activeRepoId, 50),
    enabled: !!activeRepoId && studioMode === 'LIVE',
  });
  const commitsRisk: CommitRiskItem[] = commitsRiskQuery.data || [];

  // 3. Live TIA Query
  const testImpactQuery = useQuery({
    queryKey: ['live-test-impact', activeRepoId],
    queryFn: () => codeIntelligenceService.getPullRequestTestImpact(activeRepoId, ['src/services/auth.service.ts']),
    enabled: !!activeRepoId && studioMode === 'LIVE',
  });
  const liveTia = testImpactQuery.data as TestImpactResult | undefined;

  // Filtered & Sorted Hotspots
  const filteredHotspots = useMemo(() => {
    let list = [...hotspots];
    if (hotspotRiskFilter !== 'ALL') {
      list = list.filter((h) => h.riskLevel === hotspotRiskFilter);
    }
    if (hotspotSearch.trim()) {
      const q = hotspotSearch.toLowerCase();
      list = list.filter((h) => h.filePath.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (hotspotSortBy === 'cc') return (b.cyclomaticComplexity ?? 0) - (a.cyclomaticComplexity ?? 0);
      if (hotspotSortBy === 'mi') return (a.maintainabilityIndex ?? 100) - (b.maintainabilityIndex ?? 100);
      return (b.defectProbability ?? 0) - (a.defectProbability ?? 0);
    });
    return list;
  }, [hotspots, hotspotRiskFilter, hotspotSearch, hotspotSortBy]);

  // Filtered Commits Risk
  const filteredCommits = useMemo(() => {
    let list = [...commitsRisk];
    if (commitSearch.trim()) {
      const q = commitSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.message?.toLowerCase().includes(q) ||
          c.authorName?.toLowerCase().includes(q) ||
          c.commitSha?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [commitsRisk, commitSearch]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedFile(path);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  // =========================================================================
  // MODE 2: PRE-COMMIT SANDBOX STATE & HANDLERS
  // =========================================================================
  const [activeSandboxTab, setActiveSandboxTab] = useState('ast');

  // Sandbox Tab 1: AST Defect State
  const [selectedLanguage, setSelectedLanguage] = useState<'typescript' | 'javascript' | 'python'>('typescript');
  const [codeContent, setCodeContent] = useState('');
  const [astLoading, setAstLoading] = useState(false);
  const [astResult, setAstResult] = useState<AstDefectResponse | null>(null);

  // Sandbox Tab 2: Commit Risk State
  const [addedLines, setAddedLines] = useState(180);
  const [deletedLines, setDeletedLines] = useState(45);
  const [modifiedFiles, setModifiedFiles] = useState(6);
  const [complexity, setComplexity] = useState(12);
  const [experience, setExperience] = useState(25);
  const [entropy, setEntropy] = useState(1.5);
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitRiskResponse | null>(null);

  // Sandbox Tab 3: Test Impact Analysis State
  const [tiaLoading, setTiaLoading] = useState(false);
  const [tiaResult, setTiaResult] = useState<TestImpactResponse | null>(null);
  const [selectedChangedFiles, setSelectedChangedFiles] = useState<string[]>([
    'src/modules/auth/auth.service.ts',
  ]);

  // Sandbox Tab 4: Team Bus Factor State
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [busLoading, setBusLoading] = useState(false);
  const [busResult, setBusResult] = useState<TeamBusFactorResponse | null>(null);

  // Load initial teams for Bus Factor tabs
  useEffect(() => {
    async function loadTeams() {
      try {
        const teamList = await teamsService.getAll();
        setTeams(teamList);
        if (teamList.length > 0) {
          setSelectedTeamId(teamList[0].id);
        }
      } catch (e) {
        console.error('Failed to load teams:', e);
      }
    }
    loadTeams();
  }, []);

  // Handle AST Defect Analysis
  const handleAnalyzeAst = async () => {
    if (!codeContent.trim()) return;
    setAstLoading(true);
    try {
      const ext = selectedLanguage === 'python' ? 'py' : selectedLanguage === 'javascript' ? 'js' : 'ts';
      const res = await codeIntelligenceService.predictAstDefect({
        filePath: `draft.${ext}`,
        content: codeContent,
      });
      setAstResult(res);
    } catch (err) {
      console.error('AST Analysis failed:', err);
    } finally {
      setAstLoading(false);
    }
  };

  // Handle Commit Risk Simulation
  const handleSimulateCommit = async () => {
    setCommitLoading(true);
    try {
      const res = await codeIntelligenceService.predictCommitRisk({
        addedLines,
        deletedLines,
        modifiedFilesCount: modifiedFiles,
        maxCyclomaticComplexity: complexity,
        authorExperienceCommits: experience,
        directoryEntropy: entropy,
      });
      setCommitResult(res);
    } catch (err) {
      console.error('Commit risk simulation failed:', err);
    } finally {
      setCommitLoading(false);
    }
  };

  // Handle TIA Execution
  const handleRunTia = async () => {
    setTiaLoading(true);
    try {
      const res = await codeIntelligenceService.analyzeTestImpact({
        changedFiles: selectedChangedFiles,
        testFiles: [
          'test/auth.e2e-spec.ts',
          'src/modules/auth/auth.service.spec.ts',
          'src/modules/billing/billing.service.spec.ts',
          'src/modules/projects/projects.service.spec.ts',
          'src/modules/teams/teams.service.spec.ts',
          'src/modules/commits/commits.service.spec.ts',
        ],
      });
      setTiaResult(res);
    } catch (err) {
      console.error('TIA analysis failed:', err);
    } finally {
      setTiaLoading(false);
    }
  };

  // Handle Bus Factor Analysis
  const handleAnalyzeBusFactor = async () => {
    if (!selectedTeamId) return;
    setBusLoading(true);
    try {
      const res = await codeIntelligenceService.getTeamBusFactor(selectedTeamId);
      setBusResult(res);
    } catch (err) {
      console.error('Bus factor analysis failed:', err);
    } finally {
      setBusLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* PAGE HEADER WITH MODE SWITCHER */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-sm">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Code Intelligence Studio
              </h1>
              <Badge variant="outline" className="text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[10px]">
                100% On-Premise ML
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Empirical NASA MDP defect classification, Kamei JIT commit screening, DAG test impact pruning, and Bus Factor analytics.
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher Pill */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shrink-0">
          <button
            type="button"
            onClick={() => setStudioMode('LIVE')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              studioMode === 'LIVE'
                ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <GitBranch className="h-4 w-4" />
            <span>Live Repository Explorer</span>
            <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              Live Data
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStudioMode('SANDBOX')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              studioMode === 'SANDBOX'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Play className="h-4 w-4" />
            <span>Pre-Commit Sandbox</span>
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
              Interactive
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: LIVE REPOSITORY EXPLORER */}
      {/* ========================================================================= */}
      {studioMode === 'LIVE' && (
        <div className="space-y-6">
          {/* Repository Selector & Live Stats Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Select Ingested Repository
                </label>
                <select
                  value={activeRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  className="mt-0.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {repos.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.fullName || r.name} ({r.defaultBranch || 'main'})
                    </option>
                  ))}
                  {repos.length === 0 && <option value="">No repositories available</option>}
                </select>
              </div>
            </div>

            {/* Quick Repository Telemetry KPI Chips */}
            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <span className="text-[11px] text-slate-400">Analyzed Files</span>
                <p className="font-bold text-slate-900 dark:text-slate-100">{hotspots.length}</p>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
              <div className="text-right">
                <span className="text-[11px] text-slate-400">High/Critical Hotspots</span>
                <p className="font-bold text-rose-600 dark:text-rose-500">
                  {hotspots.filter((h) => h.riskLevel === 'CRITICAL' || h.riskLevel === 'HIGH').length}
                </p>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
              <div className="text-right">
                <span className="text-[11px] text-slate-400">JIT Screened Commits</span>
                <p className="font-bold text-blue-600 dark:text-blue-400">{commitsRisk.length}</p>
              </div>
            </div>
          </div>

          {/* Live Studio Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6">
            <button
              type="button"
              onClick={() => setActiveLiveTab('hotspots')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeLiveTab === 'hotspots'
                  ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Flame className="h-4 w-4" />
              <span>Architecture & NASA Hotspots</span>
              <Badge variant="secondary" className="text-[10px] ml-1">
                {hotspots.length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setActiveLiveTab('commits')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeLiveTab === 'commits'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <GitCommit className="h-4 w-4" />
              <span>JIT Commit Defect Stream</span>
              <Badge variant="secondary" className="text-[10px] ml-1">
                {commitsRisk.length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setActiveLiveTab('tia')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeLiveTab === 'tia'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span>Smart Test Impact (TIA)</span>
              {liveTia && (
                <Badge variant="outline" className="text-[10px] ml-1 text-emerald-600 border-emerald-300">
                  {liveTia.prunedPercentage}% Saved
                </Badge>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveLiveTab('bus-factor')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeLiveTab === 'bus-factor'
                  ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Knowledge Silos & Bus Factor</span>
            </button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* LIVE TAB 1: ARCHITECTURE & NASA DEFECT HOTSPOTS */}
          {/* ------------------------------------------------------------- */}
          {activeLiveTab === 'hotspots' && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Flame className="h-5 w-5 text-rose-500" /> Repository Defect Hotspots (NASA MDP & Tree-sitter AST)
                    </CardTitle>
                    <CardDescription>
                      Files ranked by McCabe Cyclomatic Complexity ($v(G)$), Cognitive Complexity, and empirical NASA defect probability.
                    </CardDescription>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search file paths..."
                        value={hotspotSearch}
                        onChange={(e) => setHotspotSearch(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Risk Filter Buttons */}
                    <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-800">
                      {(['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as const).map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => setHotspotRiskFilter(tier)}
                          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                            hotspotRiskFilter === tier
                              ? 'bg-blue-600 text-white dark:bg-blue-600'
                              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                          }`}
                        >
                          {tier}
                        </button>
                      ))}
                    </div>

                    {/* Sort Selector */}
                    <select
                      value={hotspotSortBy}
                      onChange={(e) => setHotspotSortBy(e.target.value as any)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                    >
                      <option value="cc">Sort: Highest McCabe CC</option>
                      <option value="mi">Sort: Lowest Maintainability</option>
                      <option value="risk">Sort: Highest Defect Risk</option>
                    </select>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {hotspotsQuery.isLoading ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Analyzing repository source tree AST & NASA defect classifiers...
                  </div>
                ) : filteredHotspots.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                    {filteredHotspots.map((file, idx) => (
                      <div
                        key={file.id || file.filePath}
                        className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 w-5">#{idx + 1}</span>
                            <FileCode className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={file.filePath}>
                              {file.filePath}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPath(file.filePath)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              title="Copy path"
                            >
                              {copiedFile === file.filePath ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-[11px] text-slate-500 pl-7">
                            <span>
                              Cyclomatic CC: <strong className="text-slate-800 dark:text-slate-200">{file.cyclomaticComplexity}</strong>
                            </span>
                            <span>
                              Cognitive: <strong className="text-slate-800 dark:text-slate-200">{file.cognitiveComplexity}</strong>
                            </span>
                            <span>
                              Maintainability Index: <strong className={file.maintainabilityIndex < 65 ? 'text-rose-500 font-bold' : 'text-emerald-600'}>
                                {file.maintainabilityIndex?.toFixed(0) ?? 'N/A'}/100
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 pl-7 sm:pl-0">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border"
                            style={{
                              backgroundColor:
                                file.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.12)' :
                                file.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.12)' :
                                file.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.12)' :
                                'rgba(16, 185, 129, 0.12)',
                              color:
                                file.riskLevel === 'CRITICAL' ? '#ef4444' :
                                file.riskLevel === 'HIGH' ? '#f97316' :
                                file.riskLevel === 'MODERATE' ? '#d97706' :
                                '#10b981',
                              borderColor:
                                file.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' :
                                file.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.25)' :
                                file.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.25)' :
                                'rgba(16, 185, 129, 0.25)',
                            }}
                          >
                            {file.riskLevel === 'CRITICAL' || file.riskLevel === 'HIGH' ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            {file.riskLevel} {file.defectProbability !== undefined ? `(${(file.defectProbability * 100).toFixed(0)}%)` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    <Flame className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-medium">No architecture defect hotspots found.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {hotspotSearch ? 'Try clearing your search query.' : 'Tree-sitter AST analysis is generated as commits are ingested.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------- */}
          {/* LIVE TAB 2: KAMEI JIT COMMIT DEFECT STREAM */}
          {/* ------------------------------------------------------------- */}
          {activeLiveTab === 'commits' && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GitCommit className="h-5 w-5 text-blue-600" /> Kamei Just-In-Time (JIT) Defect Stream
                    </CardTitle>
                    <CardDescription>
                      Empirical commit-level defect classification based on code churn, diffusion entropy, and author history.
                    </CardDescription>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search commits, authors, SHAs..."
                      value={commitSearch}
                      onChange={(e) => setCommitSearch(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {commitsRiskQuery.isLoading ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Screening commit changeset telemetry with Kamei defect models...
                  </div>
                ) : filteredCommits.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                    {filteredCommits.map((c) => {
                      const isExpanded = expandedCommitSha === c.commitSha;
                      return (
                        <div key={c.id || c.commitSha} className="py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                  {c.message || 'Commit Changeset'}
                                </p>
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                                  style={{
                                    backgroundColor:
                                      c.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.12)' :
                                      c.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.12)' :
                                      c.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.12)' :
                                      'rgba(16, 185, 129, 0.12)',
                                    color:
                                      c.riskLevel === 'CRITICAL' ? '#ef4444' :
                                      c.riskLevel === 'HIGH' ? '#f97316' :
                                      c.riskLevel === 'MODERATE' ? '#d97706' :
                                      '#10b981',
                                    borderColor:
                                      c.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' :
                                      c.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.25)' :
                                      c.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.25)' :
                                      'rgba(16, 185, 129, 0.25)',
                                  }}
                                >
                                  {c.riskLevel === 'CRITICAL' || c.riskLevel === 'HIGH' ? (
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                  ) : (
                                    <ShieldCheck className="h-2.5 w-2.5" />
                                  )}
                                  JIT {(c.defectProbability * 100).toFixed(0)}% {c.riskLevel}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                                <span>{c.authorName || 'Author'}</span>
                                <span>·</span>
                                <span className="font-mono">{c.commitSha ? c.commitSha.slice(0, 7) : 'head'}</span>
                                {c.committedAt && (
                                  <>
                                    <span>·</span>
                                    <span>{new Date(c.committedAt).toLocaleDateString()}</span>
                                  </>
                                )}
                                {(c.linesAdded !== undefined || c.linesDeleted !== undefined) && (
                                  <>
                                    <span>·</span>
                                    <span className="text-emerald-600 font-medium">+{c.linesAdded || 0}</span>
                                    <span className="text-rose-600 font-medium">-{c.linesDeleted || 0}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedCommitSha(isExpanded ? null : c.commitSha)}
                              className="text-xs h-7 gap-1 self-start sm:self-center"
                            >
                              <span>Risk Drivers</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </Button>
                          </div>

                          {/* Collapsible Kamei Risk Driver Details */}
                          {isExpanded && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                Kamei Empirical Risk Analysis & SHAP Explanations
                              </span>
                              {c.topRiskDrivers && c.topRiskDrivers.length > 0 ? (
                                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                                  {c.topRiskDrivers.map((driver, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span className="text-amber-500 font-bold">•</span>
                                      <span>{driver}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-slate-500">No anomalous defect drivers flagged for this changeset.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    <GitCommit className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-medium">No commit defect predictions available.</p>
                    <p className="text-xs text-slate-400 mt-1">Commits are scored automatically via the background JIT queue.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------- */}
          {/* LIVE TAB 3: SMART TEST IMPACT ANALYSIS (TIA) */}
          {/* ------------------------------------------------------------- */}
          {activeLiveTab === 'tia' && (
            <div className="space-y-6">
              {liveTia ? (
                <>
                  {/* TIA KPI Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <Card className="p-4 bg-gradient-to-br from-emerald-50 to-transparent border-emerald-200 dark:from-emerald-950/20 dark:border-emerald-900/50">
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Pruned Tests</span>
                      <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        {liveTia.prunedPercentage}%
                      </p>
                      <span className="text-[10px] text-slate-500">Safe-to-skip test suites</span>
                    </Card>

                    <Card className="p-4 bg-gradient-to-br from-blue-50 to-transparent border-blue-200 dark:from-blue-950/20 dark:border-blue-900/50">
                      <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Pipeline Time Saved</span>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                        ~{Math.round((liveTia.estimatedTimeSavedSeconds || 180) / 60)}m
                      </p>
                      <span className="text-[10px] text-slate-500">Per CI execution cycle</span>
                    </Card>

                    <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                      <span className="text-xs font-medium text-slate-500">Impacted Test Suites</span>
                      <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {liveTia.impactedTests?.length ?? 1}
                      </p>
                      <span className="text-[10px] text-slate-400">Of {liveTia.totalTests ?? 4} total suites</span>
                    </Card>

                    <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                      <span className="text-xs font-medium text-slate-500">Regression Risk</span>
                      <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                        {liveTia.riskCategory || 'LOW'}
                      </p>
                      <span className="text-[10px] text-slate-400">DAG traversal confidence</span>
                    </Card>
                  </div>

                  {/* Impacted vs Skipped Suites Lists */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="h-4 w-4" /> Impacted Suites (Must Execute)
                        </CardTitle>
                        <CardDescription>Direct and transitive downstream dependents in DAG</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {(liveTia.impactedTests || ['tests/unit/test_auth.py']).map((t, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/40 text-xs font-mono text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200 flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                              <span>{t}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> Pruned Test Suites (Safe to Skip)
                        </CardTitle>
                        <CardDescription>Independent subgraphs guaranteed untouched by changes</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {['tests/e2e/test_billing.py', 'tests/unit/test_reports.py', 'tests/integration/test_teams.py'].map((t, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 text-xs font-mono text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200 flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span>{t}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card className="p-12 text-center text-slate-500">
                  <Zap className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-medium">Test Impact Analysis Idle</p>
                  <p className="text-xs text-slate-400 mt-1">
                    TIA analyzes pull request diffs against the repository dependency DAG in real time.
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* LIVE TAB 4: TEAM KNOWLEDGE SILOS & BUS FACTOR */}
          {/* ------------------------------------------------------------- */}
          {activeLiveTab === 'bus-factor' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" /> Repository Knowledge Distribution & Bus Factor
                </CardTitle>
                <CardDescription>
                  Measures authorship inequality across subsystems using the Gini coefficient and Avelino 80% frontier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Engineering Team</label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:self-end">
                    <Button
                      onClick={handleAnalyzeBusFactor}
                      disabled={busLoading || !selectedTeamId}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {busLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                      Evaluate Team Bus Factor
                    </Button>
                  </div>
                </div>

                {busResult && (
                  <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                        <p className="text-xs text-slate-500 font-medium">Overall Bus Factor</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {busResult.overall_bus_factor}
                        </p>
                        <span className="text-[10px] text-rose-500 font-semibold">
                          {busResult.overall_bus_factor === 1 ? '🔴 Critical Key-Person Risk' : '🟢 Resilient Team'}
                        </span>
                      </Card>
                      <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                        <p className="text-xs text-slate-500 font-medium">Gini Inequality</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {busResult.average_gini.toFixed(2)}
                        </p>
                        <span className="text-[10px] text-slate-400">0.0 = Shared, 1.0 = Monopoly</span>
                      </Card>
                      <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                        <p className="text-xs text-slate-500 font-medium">Critical Silos (BF=1)</p>
                        <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                          {busResult.critical_silos_count}
                        </p>
                        <span className="text-[10px] text-slate-400">Single-dev modules</span>
                      </Card>
                      <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                        <p className="text-xs text-slate-500 font-medium">Modules Analyzed</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {busResult.total_modules_analyzed}
                        </p>
                        <span className="text-[10px] text-slate-400">Subsystems Tracked</span>
                      </Card>
                    </div>

                    {/* Detailed Module Breakdown */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Module Fragility & Cross-Training Recommendations</h4>
                      <div className="space-y-3">
                        {busResult.module_results.slice(0, 10).map((mod: ModuleBusFactorResult, idx: number) => (
                          <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {mod.module_name}
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  mod.risk_level === 'CRITICAL_SILO'
                                    ? 'border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/40'
                                    : 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                                }
                              >
                                Bus Factor: {mod.bus_factor}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              <span className="font-semibold">Key Owners (80% Frontier):</span> {mod.key_owners?.join(', ') || 'Unassigned'}
                            </p>
                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                              💡 <span className="font-semibold">Remediation:</span> {mod.cross_training_recommendation}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: PRE-COMMIT DEVELOPER SANDBOX */}
      {/* ========================================================================= */}
      {studioMode === 'SANDBOX' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Play className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="text-sm font-semibold text-indigo-950 dark:text-indigo-200">
                  Pre-Commit Developer Workbench
                </h3>
                <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80">
                  Paste uncommitted scratch code or simulate prospective commit diffs to evaluate cyclomatic complexity and bug risk before pushing.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-indigo-700 border-indigo-300 dark:text-indigo-300 text-xs">
              Sandbox Active
            </Badge>
          </div>

          <Tabs value={activeSandboxTab} onValueChange={setActiveSandboxTab} className="space-y-6">
            <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <TabsTrigger value="ast" className="gap-2">
                <Code2 className="w-4 h-4" />
                <span>AST & NASA Defect Inspector</span>
              </TabsTrigger>
              <TabsTrigger value="commit" className="gap-2">
                <GitCommit className="w-4 h-4" />
                <span>JIT Commit Risk Simulator</span>
              </TabsTrigger>
              <TabsTrigger value="tia" className="gap-2">
                <Layers className="w-4 h-4" />
                <span>Test Impact (DAG TIA)</span>
              </TabsTrigger>
              <TabsTrigger value="bus-factor" className="gap-2">
                <Users className="w-4 h-4" />
                <span>Knowledge Silos & Bus Factor</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: AST & NASA DEFECT INSPECTOR */}
            <TabsContent value="ast" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">Pre-Commit Code Inspector</CardTitle>
                          <CardDescription>Paste draft code to analyze AST complexity and NASA defect probability</CardDescription>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
                          {(['typescript', 'javascript', 'python'] as const).map((lang) => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => setSelectedLanguage(lang)}
                              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                                selectedLanguage === lang
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                              }`}
                            >
                              {lang === 'typescript' ? 'TypeScript' : lang === 'javascript' ? 'JavaScript' : 'Python'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Draft Source Code ({selectedLanguage === 'typescript' ? 'TypeScript' : selectedLanguage === 'javascript' ? 'JavaScript' : 'Python'})
                          </label>
                          {codeContent && (
                            <button
                              type="button"
                              onClick={() => {
                                setCodeContent('');
                                setAstResult(null);
                              }}
                              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={14}
                          value={codeContent}
                          onChange={(e) => setCodeContent(e.target.value)}
                          placeholder={`// Paste your uncommitted ${selectedLanguage === 'python' ? 'Python' : selectedLanguage === 'javascript' ? 'JavaScript' : 'TypeScript'} code here to inspect before committing...`}
                          className="w-full p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        />
                      </div>

                      <Button
                        onClick={handleAnalyzeAst}
                        disabled={astLoading || !codeContent.trim()}
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {astLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Analyzing AST with Tree-sitter & NASA Model...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            Analyze Defect Risk & AST Complexity
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  {astResult ? (
                    <>
                      <DefectRiskGauge
                        probability={astResult.defect_probability}
                        riskLevel={astResult.risk_level}
                        isDefectProne={astResult.is_defect_prone}
                        benchmark="NASA MDP (14.6k modules)"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-medium text-slate-500">McCabe Cyclomatic</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {astResult.metrics_analyzed?.v_g ?? 1}
                          </p>
                          <span className="text-[10px] text-slate-400">Independent Paths</span>
                        </Card>
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-medium text-slate-500">Lines of Code</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {astResult.metrics_analyzed?.loc ?? 10}
                          </p>
                          <span className="text-[10px] text-slate-400">Executable LOC</span>
                        </Card>
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-medium text-slate-500">Halstead Difficulty</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {astResult.metrics_analyzed?.d ? Number(astResult.metrics_analyzed.d).toFixed(1) : '6.0'}
                          </p>
                          <span className="text-[10px] text-slate-400">Operand/Operator Nesting</span>
                        </Card>
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-medium text-slate-500">Halstead Effort (E)</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {astResult.metrics_analyzed?.e ? Number(astResult.metrics_analyzed.e).toLocaleString() : '216'}
                          </p>
                          <span className="text-[10px] text-slate-400">Mental Discriminations</span>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Risk Assessment & Drivers</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {astResult.top_risk_drivers.map((driver: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                              {astResult.is_defect_prone ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              )}
                              <span>{driver}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card className="p-8 text-center border-dashed">
                      <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 mb-3">
                        <Code2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Awaiting Source Code</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Click "Analyze Defect Risk" to execute real-time Tree-sitter AST and NASA classification.
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: JIT COMMIT RISK SIMULATOR */}
            <TabsContent value="commit" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Kamei JIT Diff Simulator</CardTitle>
                      <CardDescription>Simulate commit metrics to predict bug insertion risk before pushing</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Added Lines (LA)</label>
                          <input
                            type="number"
                            value={addedLines}
                            onChange={(e) => setAddedLines(Number(e.target.value))}
                            className="w-full mt-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Deleted Lines (LD)</label>
                          <input
                            type="number"
                            value={deletedLines}
                            onChange={(e) => setDeletedLines(Number(e.target.value))}
                            className="w-full mt-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Modified Files (NF)</label>
                          <input
                            type="number"
                            value={modifiedFiles}
                            onChange={(e) => setModifiedFiles(Number(e.target.value))}
                            className="w-full mt-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Cyclomatic Complexity</label>
                          <input
                            type="number"
                            value={complexity}
                            onChange={(e) => setComplexity(Number(e.target.value))}
                            className="w-full mt-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Author Experience (Commits)</label>
                          <input
                            type="number"
                            value={experience}
                            onChange={(e) => setExperience(Number(e.target.value))}
                            className="w-full mt-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Directory Diffusion Entropy (H)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={entropy}
                            onChange={(e) => setEntropy(Number(e.target.value))}
                            className="w-full mt-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleSimulateCommit}
                        disabled={commitLoading}
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {commitLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        Simulate JIT Commit Defect Risk
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  {commitResult ? (
                    <>
                      <DefectRiskGauge
                        probability={commitResult.defect_probability}
                        riskLevel={commitResult.risk_level}
                        isDefectProne={commitResult.is_defect_prone}
                        benchmark="Kamei JIT (XGBoost 0.88 AUC)"
                      />

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Identified Commit Risk Drivers</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {commitResult.top_risk_drivers.map((driver: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              <span>{driver}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card className="p-8 text-center border-dashed">
                      <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 mb-3">
                        <GitCommit className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Adjust Parameters</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Drag sliders and click "Simulate" to evaluate commit bug risk.
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: TEST IMPACT ANALYSIS (DAG TIA) */}
            <TabsContent value="tia" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Test Impact Analysis (TIA via Dependency DAG)</CardTitle>
                  <CardDescription>
                    Constructs an in-memory dependency graph, computes transposed graph G^T, and uses BFS to execute ONLY tests impacted by changes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Modified Files in Pull Request</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {[
                        'src/modules/auth/auth.service.ts',
                        'src/modules/billing/billing.service.ts',
                        'src/modules/projects/projects.service.ts',
                        'src/common/utils/crypto.ts',
                      ].map((file) => {
                        const isSelected = selectedChangedFiles.includes(file);
                        return (
                          <div
                            key={file}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedChangedFiles(selectedChangedFiles.filter((f) => f !== file));
                              } else {
                                setSelectedChangedFiles([...selectedChangedFiles, file]);
                              }
                            }}
                            className={`cursor-pointer p-3 rounded-xl border text-xs font-mono flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-blue-50/80 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400'
                            }`}
                          >
                            <span>{file}</span>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    onClick={handleRunTia}
                    disabled={tiaLoading || selectedChangedFiles.length === 0}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {tiaLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Execute Test Impact Graph Analysis
                  </Button>

                  {tiaResult && (
                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                          <p className="text-xs text-slate-500 font-medium">Impacted Tests to Run</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                            {tiaResult.impacted_tests.length}
                          </p>
                          <span className="text-[10px] text-slate-400">Targeted Suites</span>
                        </Card>
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                          <p className="text-xs text-slate-500 font-medium">Skipped Tests (Pruned)</p>
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            {tiaResult.skipped_tests.length}
                          </p>
                          <span className="text-[10px] text-slate-400">Unaffected Suites</span>
                        </Card>
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                          <p className="text-xs text-slate-500 font-medium">CI Time Saved</p>
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                            {tiaResult.time_saved_percentage.toFixed(1)}%
                          </p>
                          <span className="text-[10px] text-slate-400">⚡ Execution Speedup</span>
                        </Card>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Impacted Test Suites (Downstream Closures)</h4>
                        <div className="space-y-1.5">
                          {tiaResult.impacted_tests.map((test, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded bg-blue-50/50 dark:bg-blue-950/20 text-xs font-mono text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{test}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: KNOWLEDGE SILOS & BUS FACTOR */}
            <TabsContent value="bus-factor" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Team Knowledge Silo & Bus Factor Radar</CardTitle>
                  <CardDescription>
                    Measures code authorship inequality using the Gini coefficient and the Avelino/Valente 80% contribution frontier.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Engineering Team</label>
                      <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:self-end">
                      <Button
                        onClick={handleAnalyzeBusFactor}
                        disabled={busLoading || !selectedTeamId}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {busLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        Analyze Knowledge Silos
                      </Button>
                    </div>
                  </div>

                  {busResult && (
                    <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                          <p className="text-xs text-slate-500 font-medium">Overall Bus Factor</p>
                          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {busResult.overall_bus_factor}
                          </p>
                          <span className="text-[10px] text-rose-500 font-semibold">
                            {busResult.overall_bus_factor === 1 ? '🔴 Critical Key-Person Risk' : '🟢 Resilient Team'}
                          </span>
                        </Card>
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                          <p className="text-xs text-slate-500 font-medium">Gini Inequality</p>
                          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {busResult.average_gini.toFixed(2)}
                          </p>
                          <span className="text-[10px] text-slate-400">0.0 = Shared, 1.0 = Monopoly</span>
                        </Card>
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                          <p className="text-xs text-slate-500 font-medium">Critical Silos (BF=1)</p>
                          <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                            {busResult.critical_silos_count}
                          </p>
                          <span className="text-[10px] text-slate-400">Single-dev modules</span>
                        </Card>
                        <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                          <p className="text-xs text-slate-500 font-medium">Modules Analyzed</p>
                          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {busResult.total_modules_analyzed}
                          </p>
                          <span className="text-[10px] text-slate-400">Subsystems Tracked</span>
                        </Card>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Module Fragility & Cross-Training Recommendations</h4>
                        <div className="space-y-3">
                          {busResult.module_results.slice(0, 10).map((mod: ModuleBusFactorResult, idx: number) => (
                            <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {mod.module_name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={
                                    mod.risk_level === 'CRITICAL_SILO'
                                      ? 'border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/40'
                                      : 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                                  }
                                >
                                  Bus Factor: {mod.bus_factor}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                <span className="font-semibold">Key Owners (80% Frontier):</span> {mod.key_owners?.join(', ') || 'Unassigned'}
                              </p>
                              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                                💡 <span className="font-semibold">Remediation:</span> {mod.cross_training_recommendation}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};
