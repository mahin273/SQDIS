import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { DefectRiskGauge } from './components/DefectRiskGauge';
import { ArchitectureTreemapCard } from './components/ArchitectureTreemapCard';
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
import type { RemediationResponse } from '@/types';
import { formatDate } from '@/lib/utils';
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
  ChevronRight,
  Copy,
  ExternalLink,
  Lightbulb,
  Sparkles,
  ArrowUpRight,
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

  // Drawer States
  const [selectedHotspot, setSelectedHotspot] = useState<RepositoryHotspot | null>(null);
  const [remediationAdvice, setRemediationAdvice] = useState<RemediationResponse | null>(null);
  const [remediationLoading, setRemediationLoading] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<CommitRiskItem | null>(null);

  // Fetch only connected / ingested repositories for the organization
  const reposQuery = useQuery({
    queryKey: ['repositories', 'connected'],
    queryFn: () => repositoriesService.getConnected(),
  });

  const repos = useMemo(() => {
    const data = reposQuery.data;
    let list: any[] = [];
    if (Array.isArray(data)) list = data;
    else if (data && typeof data === 'object' && Array.isArray((data as any).data)) list = (data as any).data;
    return list.filter((r: any) => (r.isActive ?? r.isEnabled ?? false) && !!r.id);
  }, [reposQuery.data]);

  const activeRepo = useMemo(() => {
    return repos.find((r: any) => r.id === selectedRepoId) || repos[0] || null;
  }, [repos, selectedRepoId]);

  const activeRepoId = activeRepo?.id || '';

  // 0. Live Repository Telemetry Aggregates (True DB Totals)
  const repoStatsQuery = useQuery({
    queryKey: ['repository-intelligence-stats', activeRepoId],
    queryFn: () => codeIntelligenceService.getRepositoryStats(activeRepoId),
    enabled: !!activeRepoId && studioMode === 'LIVE',
  });
  const repoStats = repoStatsQuery.data;

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

  // 3. Live TIA Query (bound dynamically to active repo)
  const testImpactQuery = useQuery({
    queryKey: ['live-test-impact', activeRepoId],
    queryFn: () => codeIntelligenceService.getPullRequestTestImpact(activeRepoId, []),
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

  const handleOpenHotspotDrawer = async (hotspot: RepositoryHotspot) => {
    setSelectedHotspot(hotspot);
    setRemediationAdvice(null);
    setRemediationLoading(true);
    try {
      const ext = hotspot.filePath.endsWith('.py')
        ? 'python'
        : hotspot.filePath.endsWith('.js')
        ? 'javascript'
        : 'typescript';
      const advice = await codeIntelligenceService.getRemediationAdvice({
        code: `// File: ${hotspot.filePath}\n// McCabe Cyclomatic: ${hotspot.cyclomaticComplexity}\n// Cognitive: ${hotspot.cognitiveComplexity}`,
        filePath: hotspot.filePath,
        cyclomaticComplexity: hotspot.cyclomaticComplexity,
        language: ext,
      });
      setRemediationAdvice(advice);
    } catch (err) {
      console.warn('Could not generate automatic remediation recipe for hotspot:', err);
    } finally {
      setRemediationLoading(false);
    }
  };

  const handleOpenCommitDrawer = (commit: CommitRiskItem) => {
    setSelectedCommit(commit);
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
  const [selectedChangedFiles] = useState<string[]>([
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
  const handleAnalyzeCommit = async () => {
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
      console.error('Commit risk analysis failed:', err);
    } finally {
      setCommitLoading(false);
    }
  };

  // Handle Test Impact Analysis Simulation
  const handleAnalyzeTia = async () => {
    setTiaLoading(true);
    try {
      const res = await codeIntelligenceService.analyzeTestImpact({
        changedFiles: selectedChangedFiles,
      });
      setTiaResult(res);
    } catch (err) {
      console.error('TIA failed:', err);
    } finally {
      setTiaLoading(false);
    }
  };

  // Handle Team Bus Factor Analysis
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
      {/* EXECUTIVE INTELLIGENCE STUDIO HERO BANNER */}
      {/* ========================================================================= */}
      <Card className="overflow-hidden border-slate-200/90 shadow-xs dark:border-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Identity & Metadata */}
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md">
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      Code Intelligence Studio
                    </h1>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    Predictive defect classification, McCabe/Cognitive AST diagnostics, and Kamei Just-In-Time change risk analytics.
                  </p>
                </div>
              </div>

              {/* Connected Repository & Sync Pills */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
                  <GitBranch className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Repository:</span>
                  <select
                    value={activeRepoId}
                    onChange={(e) => setSelectedRepoId(e.target.value)}
                    className="bg-transparent font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
                  >
                    {repos.map((r: any) => (
                      <option key={r.id} value={r.id} className="dark:bg-slate-900">
                        {r.fullName || r.name} ({r.defaultBranch || 'main'})
                      </option>
                    ))}
                    {repos.length === 0 && <option value="">No connected repositories</option>}
                  </select>
                </div>

                {repoStats && (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    <GitCommit className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{repoStats.totalCommits} Commits Screened</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mode Switcher Pill */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shrink-0 self-start lg:self-center">
              <button
                type="button"
                onClick={() => setStudioMode('LIVE')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  studioMode === 'LIVE'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <GitBranch className="h-4 w-4" />
                <span>Live Repository Explorer</span>
                <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  Live
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStudioMode('SANDBOX')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  studioMode === 'SANDBOX'
                    ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Play className="h-4 w-4" />
                <span>Pre-Commit Sandbox</span>
                <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  Simulation
                </span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* MODE 1: LIVE REPOSITORY EXPLORER */}
      {/* ========================================================================= */}
      {studioMode === 'LIVE' && (
        <div className="space-y-6">
          {/* 4-Card Executive Telemetry KPI Strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Defect Risk Exposure
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                    <Flame className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {repoStats ? (repoStats.hotspots.critical > 50 ? 'Critical' : 'Moderate') : 'Analyzing'}
                  </span>
                  <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-mono">
                    NASA MDP
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {repoStats ? `${repoStats.hotspots.critical} critical severity files detected` : 'Evaluating architecture modules'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Architecture Hotspots
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
                    {repoStats ? repoStats.hotspots.total : hotspots.length}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {repoStats ? `${repoStats.hotspots.critical} Crit · ${repoStats.hotspots.high} High` : 'Flagged'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  High McCabe CC & cognitive fatigue
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    JIT Screened Commits
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                    <GitCommit className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
                    {repoStats ? `${repoStats.jitScreenedCommits}` : commitsRisk.length}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    / {repoStats ? repoStats.totalCommits : '380'}
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {repoStats && repoStats.totalCommits > 0 ? `${((repoStats.jitScreenedCommits / repoStats.totalCommits) * 100).toFixed(0)}%` : '100%'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Pre-merge Kamei 14-feature classifier
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs dark:border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Analyzed Codebase
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                    <FileCode className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
                    {repoStats ? repoStats.analyzedFiles.toLocaleString() : '866'}
                  </span>
                  <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 text-[10px]">
                    Files
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tree-sitter AST & Halstead metrics
                </p>
              </CardContent>
            </Card>
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
              <span>Architecture Hotspots</span>
              <Badge variant="secondary" className="text-[10px] ml-1">
                {repoStats ? repoStats.hotspots.total : hotspots.length}
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
              <span>Commit Defect Stream</span>
              <Badge variant="secondary" className="text-[10px] ml-1">
                {repoStats ? repoStats.jitScreenedCommits : commitsRisk.length}
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
              {liveTia && liveTia.prunedPercentage > 0 && (
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
          {/* LIVE TAB 1: ARCHITECTURE DEFECT HOTSPOTS */}
          {/* ------------------------------------------------------------- */}
          {activeLiveTab === 'hotspots' && (
            <div className="space-y-6">
              {/* Interactive Hierarchical Treemap & Hotspot Quadrant Visualizer */}
              <ArchitectureTreemapCard
                repositoryId={activeRepoId}
                repositoryName={activeRepo?.name || activeRepo?.fullName || 'Active Repository'}
              />

              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Flame className="h-5 w-5 text-rose-500" /> Repository Defect Hotspots
                      </CardTitle>
                      <CardDescription>
                        Files ranked by Cyclomatic Complexity, Cognitive Complexity, and Defect Probability. Click any row to inspect code smells and refactoring blueprints.
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
                  {/* Interactive AST Inspection Info Strip */}
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs shrink-0">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-semibold">Interactive AST Defect Diagnostics:</span>{' '}
                        Click any file row or the <span className="font-semibold text-indigo-600 dark:text-indigo-400">Remediate Blueprint</span> button to slide open instant Tree-sitter complexity metrics and automated refactoring guidance.
                      </div>
                    </div>
                    <Badge variant="outline" className="border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300 hidden md:inline-flex shrink-0">
                      Slide-Over Drawer
                    </Badge>
                  </div>

                  {hotspotsQuery.isLoading ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                      Analyzing repository files for complexity and defect risk...
                    </div>
                  ) : filteredHotspots.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                      {filteredHotspots.map((file, idx) => (
                        <div
                          key={file.id || file.filePath}
                          onClick={() => handleOpenHotspotDrawer(file)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 px-3 rounded-lg gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 w-5">#{idx + 1}</span>
                              <FileCode className="h-4 w-4 text-slate-400 shrink-0 group-hover:text-indigo-600 transition-colors" />
                              <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate" title={file.filePath}>
                                {file.filePath}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyPath(file.filePath);
                                }}
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenHotspotDrawer(file);
                              }}
                              className="h-8 gap-1.5 border-indigo-200 text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 font-semibold text-xs shadow-xs"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Remediate Blueprint</span>
                              <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-500">
                      <Flame className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm font-medium">No architecture defect hotspots found.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {hotspotSearch ? 'Try clearing your search query.' : 'Complexity analysis is generated as commits are ingested.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* LIVE TAB 2: COMMIT DEFECT RISK STREAM */}
          {/* ------------------------------------------------------------- */}
          {activeLiveTab === 'commits' && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GitCommit className="h-5 w-5 text-blue-600" /> Commit Defect Risk Stream
                    </CardTitle>
                    <CardDescription>
                      Commit-level defect prediction based on code churn, file diffusion, and author history. Click any commit to inspect drivers and author telemetry.
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
                {/* Interactive JIT Commit Risk Info Strip */}
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
                      <GitCommit className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-semibold">Kamei JIT Defect Screening:</span>{' '}
                      Click any commit or <span className="font-semibold text-blue-600 dark:text-blue-400">Inspect JIT Drivers</span> to review pre-merge risk probability, line churn deltas, and contributor profile connections.
                    </div>
                  </div>
                  <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300 hidden md:inline-flex shrink-0">
                    Slide-Over Drawer
                  </Badge>
                </div>

                {commitsRiskQuery.isLoading ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Screening commit changes for defect risk...
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
                                {c.developerId ? (
                                  <Link
                                    to={`/developers/${c.developerId}`}
                                    className="font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                                  >
                                    {c.authorName || 'Author'}
                                  </Link>
                                ) : (
                                  <span>{c.authorName || 'Author'}</span>
                                )}
                                <span>&bull;</span>
                                <span className="font-mono">{c.commitSha ? c.commitSha.slice(0, 7) : 'head'}</span>
                                {c.committedAt && (
                                  <>
                                    <span>&bull;</span>
                                    <span>{new Date(c.committedAt).toLocaleDateString()}</span>
                                  </>
                                )}
                                {(c.linesAdded !== undefined || c.linesDeleted !== undefined) && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="text-emerald-600 font-medium">+{c.linesAdded || 0}</span>
                                    <span className="text-rose-600 font-medium">-{c.linesDeleted || 0}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenCommitDrawer(c)}
                                className="h-8 gap-1.5 border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 font-semibold text-xs shadow-xs"
                              >
                                <GitCommit className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                <span>Inspect JIT Drivers</span>
                                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedCommitSha(isExpanded ? null : c.commitSha)}
                                className="text-xs h-7 gap-1 text-slate-400"
                              >
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>

                          {/* Collapsible Commit Risk Driver Details */}
                          {isExpanded && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                Commit Defect Risk Breakdown & Key Drivers
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
                        {liveTia.impactedTests?.length ?? 0}
                      </p>
                      <span className="text-[10px] text-slate-400">Of {liveTia.totalTests ?? 0} total suites</span>
                    </Card>

                    <Card className="p-4 bg-slate-50 dark:bg-slate-900/60">
                      <span className="text-xs font-medium text-slate-500">Regression Risk</span>
                      <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                        {liveTia.riskCategory || 'LOW'}
                      </p>
                      <span className="text-[10px] text-slate-400">Dependency confidence</span>
                    </Card>
                  </div>

                  {/* Impacted vs Skipped Suites Lists */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="h-4 w-4" /> Impacted Suites (Must Execute)
                        </CardTitle>
                        <CardDescription>Downstream test suites affected by changed code</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {liveTia.impactedTests && liveTia.impactedTests.length > 0 ? (
                            liveTia.impactedTests.map((t, idx) => (
                              <div key={idx} className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/40 text-xs font-mono text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                <span>{t}</span>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                              No downstream test suites impacted by the current module diff.
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> Pruned Test Suites (Safe to Skip)
                        </CardTitle>
                        <CardDescription>Independent test suites untouched by changes</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/40 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200 space-y-1.5">
                          <p className="font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            {liveTia.prunedPercentage}% of total suites pruned
                          </p>
                          <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                            Static dependency analysis confirms independent modules are isolated from current changes, saving ~{Math.round((liveTia.estimatedTimeSavedSeconds || 180) / 60)} minutes of build execution.
                          </p>
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
                    TIA analyzes pull request diffs against code dependencies in real time.
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
                  Measures code ownership concentration and identifies single points of failure across your team.
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
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold mt-1">
                          {busResult.overall_bus_factor === 1 ? (
                            <>
                              <AlertTriangle className="h-3 w-3 text-rose-500" />
                              <span className="text-rose-500">Critical Key-Person Risk</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              <span className="text-emerald-500">Resilient Team</span>
                            </>
                          )}
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
                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800 flex items-start gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold">Remediation:</span> {mod.cross_training_recommendation}
                              </div>
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
                <span>Code Complexity & Defect Inspector</span>
              </TabsTrigger>
              <TabsTrigger value="commit" className="gap-2">
                <GitCommit className="w-4 h-4" />
                <span>Commit Risk Simulator</span>
              </TabsTrigger>
              <TabsTrigger value="tia" className="gap-2">
                <Layers className="w-4 h-4" />
                <span>Test Impact Analysis</span>
              </TabsTrigger>
              <TabsTrigger value="bus-factor" className="gap-2">
                <Users className="w-4 h-4" />
                <span>Knowledge Silos & Bus Factor</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: CODE COMPLEXITY & DEFECT INSPECTOR */}
            <TabsContent value="ast" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">Pre-Commit Code Inspector</CardTitle>
                          <CardDescription>Paste draft code to analyze complexity and defect probability</CardDescription>
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
                            Analyzing code complexity and defect risk...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            Analyze Defect Risk & Code Complexity
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
                        benchmark="Code Defect Model"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <Card className="p-3 bg-slate-50 dark:bg-slate-900/60">
                          <span className="text-[11px] text-slate-400 font-medium">Cyclomatic CC</span>
                          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                            {astResult.metrics_analyzed?.cyclomatic_complexity != null ? Math.round(astResult.metrics_analyzed.cyclomatic_complexity) : 'N/A'}
                          </p>
                          <span className="text-[10px] text-slate-400">McCabe Decision paths</span>
                        </Card>
                        <Card className="p-3 bg-slate-50 dark:bg-slate-900/60">
                          <span className="text-[11px] text-slate-400 font-medium">Halstead Volume</span>
                          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                            {astResult.metrics_analyzed?.halstead_volume != null ? Math.round(astResult.metrics_analyzed.halstead_volume) : 'N/A'}
                          </p>
                          <span className="text-[10px] text-slate-400">Program size & vocabulary</span>
                        </Card>
                      </div>
                    </>
                  ) : (
                    <Card className="p-12 text-center text-slate-400 border-dashed">
                      <Code2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium">No Code Analyzed Yet</p>
                      <p className="text-xs text-slate-500 mt-1">Paste a code snippet to view instant complexity metrics.</p>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: COMMIT RISK SIMULATOR */}
            <TabsContent value="commit" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Commit Risk Simulator</CardTitle>
                      <CardDescription>Adjust prospective commit parameters to simulate JIT defect classification</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Lines Added ({addedLines})</label>
                          <input
                            type="range"
                            min="1"
                            max="1000"
                            value={addedLines}
                            onChange={(e) => setAddedLines(Number(e.target.value))}
                            className="w-full mt-2"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Lines Deleted ({deletedLines})</label>
                          <input
                            type="range"
                            min="0"
                            max="500"
                            value={deletedLines}
                            onChange={(e) => setDeletedLines(Number(e.target.value))}
                            className="w-full mt-2"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Modified Files ({modifiedFiles})</label>
                          <input
                            type="range"
                            min="1"
                            max="50"
                            value={modifiedFiles}
                            onChange={(e) => setModifiedFiles(Number(e.target.value))}
                            className="w-full mt-2"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Complexity Delta ({complexity})</label>
                          <input
                            type="range"
                            min="1"
                            max="50"
                            value={complexity}
                            onChange={(e) => setComplexity(Number(e.target.value))}
                            className="w-full mt-2"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Author Experience ({experience} commits)</label>
                          <input
                            type="range"
                            min="1"
                            max="200"
                            value={experience}
                            onChange={(e) => setExperience(Number(e.target.value))}
                            className="w-full mt-2"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Directory Entropy ({entropy})</label>
                          <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.1"
                            value={entropy}
                            onChange={(e) => setEntropy(Number(e.target.value))}
                            className="w-full mt-2"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleAnalyzeCommit}
                        disabled={commitLoading}
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white mt-4"
                      >
                        {commitLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        Run Kamei JIT Defect Simulation
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-5">
                  {commitResult ? (
                    <DefectRiskGauge
                      probability={commitResult.defect_probability}
                      riskLevel={commitResult.risk_level}
                      isDefectProne={commitResult.is_defect_prone}
                      benchmark="Kamei JIT Commit Model"
                    />
                  ) : (
                    <Card className="p-12 text-center text-slate-400 border-dashed">
                      <GitCommit className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium">Simulation Idle</p>
                      <p className="text-xs text-slate-500 mt-1">Adjust parameters to simulate JIT commit risk.</p>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: SMART TEST IMPACT ANALYSIS */}
            <TabsContent value="tia" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pre-Commit Smart Test Impact Analysis</CardTitle>
                  <CardDescription>Simulates safe test suite pruning using the static dependency graph</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={handleAnalyzeTia}
                    disabled={tiaLoading}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {tiaLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Evaluate Test Impact
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
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 justify-center mt-1">
                            <Zap className="h-3 w-3 text-amber-500" /> Execution Speedup
                          </span>
                        </Card>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Impacted Test Suites (Must Run)</h4>
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
                    Measures code ownership distribution and key developer dependencies across modules.
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold mt-1">
                            {busResult.overall_bus_factor === 1 ? (
                              <>
                                <AlertTriangle className="h-3 w-3 text-rose-500" />
                                <span className="text-rose-500">Critical Key-Person Risk</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                <span className="text-emerald-500">Resilient Team</span>
                              </>
                            )}
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
                              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800 flex items-start gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold">Remediation:</span> {mod.cross_training_recommendation}
                                </div>
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

      {/* ========================================================================= */}
      {/* SLIDE-OVER QUICK INSPECTION DRAWER: ARCHITECTURE HOTSPOT */}
      {/* ========================================================================= */}
      <Sheet open={!!selectedHotspot} onOpenChange={(open) => !open && setSelectedHotspot(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-6 flex flex-col justify-between overflow-y-auto">
          {selectedHotspot && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={selectedHotspot.filePath}>
                        {selectedHotspot.filePath.split('/').pop()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyPath(selectedHotspot.filePath)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                        title="Copy path"
                      >
                        {copiedFile === selectedHotspot.filePath ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <SheetTitle className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 break-all font-normal">
                      {selectedHotspot.filePath}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tree-sitter AST & Complexity Diagnostics
                    </SheetDescription>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border shrink-0"
                    style={{
                      backgroundColor:
                        selectedHotspot.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.12)' :
                        selectedHotspot.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.12)' :
                        selectedHotspot.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.12)' :
                        'rgba(16, 185, 129, 0.12)',
                      color:
                        selectedHotspot.riskLevel === 'CRITICAL' ? '#ef4444' :
                        selectedHotspot.riskLevel === 'HIGH' ? '#f97316' :
                        selectedHotspot.riskLevel === 'MODERATE' ? '#d97706' :
                        '#10b981',
                      borderColor:
                        selectedHotspot.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' :
                        selectedHotspot.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.25)' :
                        selectedHotspot.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.25)' :
                        'rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    {selectedHotspot.riskLevel} RISK
                  </span>
                </div>
              </SheetHeader>

              {/* 4-Card Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                  <span className="text-[11px] text-slate-400 font-medium">McCabe CC</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedHotspot.cyclomaticComplexity}
                  </p>
                  <span className="text-[10px] text-slate-400">{selectedHotspot.cyclomaticComplexity > 15 ? 'High Risk' : 'Acceptable'}</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                  <span className="text-[11px] text-slate-400 font-medium">Cognitive</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedHotspot.cognitiveComplexity}
                  </p>
                  <span className="text-[10px] text-slate-400">Mental load</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                  <span className="text-[11px] text-slate-400 font-medium">Maintainability</span>
                  <p className={`text-lg font-bold mt-0.5 ${selectedHotspot.maintainabilityIndex < 65 ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {selectedHotspot.maintainabilityIndex?.toFixed(0) ?? 'N/A'}/100
                  </p>
                  <span className="text-[10px] text-slate-400">{selectedHotspot.maintainabilityIndex < 65 ? 'Difficult' : 'Healthy'}</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                  <span className="text-[11px] text-slate-400 font-medium">Defect Probability</span>
                  <p className="text-lg font-bold text-rose-600 mt-0.5">
                    {selectedHotspot.defectProbability !== undefined ? `${(selectedHotspot.defectProbability * 100).toFixed(0)}%` : 'N/A'}
                  </p>
                  <span className="text-[10px] text-slate-400">NASA MDP</span>
                </div>
              </div>

              {/* Refactoring Guidance & Remediation Blueprint */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    Automated Code Remediation Blueprint
                  </h4>
                  {remediationLoading && (
                    <span className="text-[11px] text-indigo-500 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Analyzing AST...
                    </span>
                  )}
                </div>

                {remediationLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400 border rounded-xl border-dashed">
                    Synthesizing code smells and refactoring strategies...
                  </div>
                ) : remediationAdvice && remediationAdvice.recipes && remediationAdvice.recipes.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-indigo-950 dark:text-indigo-200">
                          {remediationAdvice.totalSmellsFound} Structural Smells Diagnosed
                        </span>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                          Refactoring potential score: {remediationAdvice.refactoringPotentialScore}/100
                        </p>
                      </div>
                    </div>

                    {remediationAdvice.recipes.map((recipe, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {recipe.title}
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Strategy: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{recipe.recommendedStrategy}</span>
                            </p>
                          </div>
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] py-0">
                            -{recipe.estimatedComplexityReductionPct}% CC
                          </Badge>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {recipe.explanation}
                        </p>

                        {recipe.stepByStep && recipe.stepByStep.length > 0 && (
                          <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Step-by-step action plan:</p>
                            {recipe.stepByStep.map((step, sIdx) => (
                              <div key={sIdx} className="flex items-start gap-1.5">
                                <span className="text-indigo-500 font-bold">{sIdx + 1}.</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {recipe.afterSnippet && (
                          <div className="space-y-1 text-xs">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Target Refactored Pattern</span>
                            <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800">
                              <code>{recipe.afterSnippet}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-900/40 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Structural Complexity Remediation
                    </span>
                    <p className="text-slate-600 dark:text-slate-300">
                      This file exhibits a McCabe cyclomatic complexity of {selectedHotspot.cyclomaticComplexity}. Recommended refactoring actions:
                    </p>
                    <ul className="space-y-1 text-slate-500 list-disc list-inside text-[11px]">
                      <li>Invert deeply nested condition branches into early guard return statements.</li>
                      <li>Decompose functions exceeding 30 lines into focused helper functions.</li>
                      <li>Extract polymorphic switch/case statements into a strategy dispatch table.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ========================================================================= */}
      {/* SLIDE-OVER QUICK INSPECTION DRAWER: COMMIT DEFECT RISK */}
      {/* ========================================================================= */}
      <Sheet open={!!selectedCommit} onOpenChange={(open) => !open && setSelectedCommit(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-6 flex flex-col justify-between overflow-y-auto">
          {selectedCommit && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {selectedCommit.commitSha.slice(0, 7)}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        Kamei JIT Classifier
                      </Badge>
                    </div>
                    <SheetTitle className="text-base font-bold text-slate-950 dark:text-white mt-2">
                      {selectedCommit.message}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Committed on {formatDate(selectedCommit.committedAt)}
                    </SheetDescription>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border shrink-0"
                    style={{
                      backgroundColor:
                        selectedCommit.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.12)' :
                        selectedCommit.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.12)' :
                        selectedCommit.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.12)' :
                        'rgba(16, 185, 129, 0.12)',
                      color:
                        selectedCommit.riskLevel === 'CRITICAL' ? '#ef4444' :
                        selectedCommit.riskLevel === 'HIGH' ? '#f97316' :
                        selectedCommit.riskLevel === 'MODERATE' ? '#d97706' :
                        '#10b981',
                      borderColor:
                        selectedCommit.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' :
                        selectedCommit.riskLevel === 'HIGH' ? 'rgba(249, 115, 22, 0.25)' :
                        selectedCommit.riskLevel === 'MODERATE' ? 'rgba(245, 158, 11, 0.25)' :
                        'rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    {selectedCommit.riskLevel} ({(selectedCommit.defectProbability * 100).toFixed(0)}%)
                  </span>
                </div>
              </SheetHeader>

              {/* Author Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedCommit.authorName} size="md" />
                  <div>
                    <p className="text-xs text-slate-400">Author</p>
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{selectedCommit.authorName}</p>
                  </div>
                </div>
                {selectedCommit.developerId ? (
                  <Link to={`/developers/${selectedCommit.developerId}`}>
                    <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 text-indigo-600 dark:text-indigo-400">
                      <span>View Contributor Profile</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                ) : (
                  <span className="text-xs text-slate-400 italic">Unlinked Author</span>
                )}
              </div>

              {/* Change Footprint Metric Box */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400">Lines Added</span>
                  <p className="text-lg font-bold text-emerald-600">+{selectedCommit.linesAdded || 0}</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400">Lines Deleted</span>
                  <p className="text-lg font-bold text-rose-600">-{selectedCommit.linesDeleted || 0}</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400">Defect Probability</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {(selectedCommit.defectProbability * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Kamei JIT Defect Drivers */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Kamei JIT Defect Risk Drivers
                </h4>
                {selectedCommit.topRiskDrivers && selectedCommit.topRiskDrivers.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {selectedCommit.topRiskDrivers.map((driver, i) => (
                      <div key={i} className="p-3 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 flex items-start gap-2">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{driver}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400 italic">
                    No anomalous defect risk drivers flagged for this changeset.
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
