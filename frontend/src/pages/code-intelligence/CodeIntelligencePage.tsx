import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DefectRiskGauge } from './components/DefectRiskGauge';
import {
  codeIntelligenceService,
  type AstDefectResponse,
  type CommitRiskResponse,
  type TestImpactResponse,
  type TeamBusFactorResponse,
} from '@/services/codeIntelligence.service';
import { teamsService } from '@/services/teams.service';
import {
  BrainCircuit,
  Code2,
  GitCommit,
  Layers,
  Users,
  Play,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Check,
} from 'lucide-react';

const PRESETS = {
  clean: {
    name: 'Clean Utility',
    path: 'src/utils/math.ts',
    code: `export function add(a: number, b: number): number {\n  return a + b;\n}\n\nexport function multiply(a: number, b: number): number {\n  return a * b;\n}`,
  },
  parser: {
    name: 'Token Parser',
    path: 'src/core/parser.ts',
    code: `export function parseToken(stream: any[], state: number): number {\n  let ret = 0;\n  if (state === 1) {\n    for (let i = 0; i < stream.length; i++) {\n      if (stream[i] === 10) ret += 1;\n      else if (stream[i] === 20) ret += 2;\n      else while (stream[i] > 0) { stream[i]--; ret++; }\n    }\n  } else if (state === 2) {\n    switch (stream.length) {\n      case 1: ret = 100; break;\n      case 2: ret = 200; break;\n      default: ret = -1;\n    }\n  }\n  return ret;\n}`,
  },
  monolith: {
    name: 'God Function Monolith',
    path: 'legacy/monolith.ts',
    code: `export function executeMonolithTransaction(ctx: any, payload: any, fallback: boolean) {\n  let state = 0;\n  if (!ctx || !ctx.user || !ctx.session) throw new Error("Unauthorized");\n  for (let i = 0; i < payload.items.length; i++) {\n    if (payload.items[i].active && (payload.items[i].priority > 5 || fallback)) {\n      for (let j = 0; j < payload.items[i].rules.length; j++) {\n        if (payload.items[i].rules[j].valid && payload.items[i].rules[j].score > 80) {\n          state += payload.items[i].rules[j].weight * 1.5;\n        } else if (payload.items[i].rules[j].critical) {\n          state -= 50;\n        } else {\n          while (state < 0) { state += 10; }\n        }\n      }\n    } else {\n      switch (payload.code) {\n        case 1: state = 10; break;\n        case 2: state = 20; break;\n        case 3: state = 30; break;\n        default: state = -1;\n      }\n    }\n  }\n  return state;\n}`,
  },
};

export const CodeIntelligencePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ast');

  // Tab 1: AST Defect State
  const [codeContent, setCodeContent] = useState(PRESETS.clean.code);
  const [filePath, setFilePath] = useState(PRESETS.clean.path);
  const [astLoading, setAstLoading] = useState(false);
  const [astResult, setAstResult] = useState<AstDefectResponse | null>(null);

  // Tab 2: Commit Risk State
  const [addedLines, setAddedLines] = useState(180);
  const [deletedLines, setDeletedLines] = useState(45);
  const [modifiedFiles, setModifiedFiles] = useState(6);
  const [complexity, setComplexity] = useState(12);
  const [experience, setExperience] = useState(25);
  const [entropy, setEntropy] = useState(1.5);
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitRiskResponse | null>(null);

  // Tab 3: Test Impact Analysis State
  const [tiaLoading, setTiaLoading] = useState(false);
  const [tiaResult, setTiaResult] = useState<TestImpactResponse | null>(null);
  const [selectedChangedFiles, setSelectedChangedFiles] = useState<string[]>([
    'src/modules/auth/auth.service.ts',
  ]);

  // Tab 4: Team Bus Factor State
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [busLoading, setBusLoading] = useState(false);
  const [busResult, setBusResult] = useState<TeamBusFactorResponse | null>(null);

  // Load initial teams for Tab 4
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
      const res = await codeIntelligenceService.predictAstDefect({
        filePath,
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
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Code Intelligence & ML Studio
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                100% On-Premise empirical defect prediction, Tree-sitter AST complexity, DAG TIA & Bus Factor resilience
              </p>
            </div>
          </div>
        </div>

        <Badge variant="outline" className="w-fit gap-1.5 py-1 px-3 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
          <Sparkles className="w-3.5 h-3.5" />
          XGBoost + Tree-sitter + NASA MDP Active
        </Badge>
      </div>

      {/* Main Studio Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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

        {/* ==================== TAB 1: AST & NASA DEFECT INSPECTOR ==================== */}
        <TabsContent value="ast" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Editor & Presets */}
            <div className="lg:col-span-7 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Source Code Workbench</CardTitle>
                      <CardDescription>Paste code or select benchmark presets</CardDescription>
                    </div>
                    {/* Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-slate-500 font-medium mr-1">Presets:</span>
                      {Object.entries(PRESETS).map(([key, item]) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => {
                            setCodeContent(item.code);
                            setFilePath(item.path);
                          }}
                        >
                          {item.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">File Path</label>
                    <input
                      type="text"
                      value={filePath}
                      onChange={(e) => setFilePath(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Source Code (TypeScript / Python / JavaScript)</label>
                    <textarea
                      rows={12}
                      value={codeContent}
                      onChange={(e) => setCodeContent(e.target.value)}
                      className="w-full mt-1 p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
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

            {/* Right Column: Intelligence Output */}
            <div className="lg:col-span-5 space-y-4">
              {astResult ? (
                <>
                  <DefectRiskGauge
                    probability={astResult.defect_probability}
                    riskLevel={astResult.risk_level}
                    isDefectProne={astResult.is_defect_prone}
                    benchmark="NASA MDP (14.6k modules)"
                  />

                  {/* AST Complexity Cards */}
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

                  {/* Top Risk Drivers */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Risk Assessment & Drivers</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {astResult.top_risk_drivers.map((driver, idx) => (
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
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Analysis Executed Yet</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Click "Analyze Defect Risk" to evaluate McCabe CC and Halstead metrics with Tree-sitter.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ==================== TAB 2: COMMIT RISK SIMULATOR ==================== */}
        <TabsContent value="commit" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pull Request & Commit Risk Simulator</CardTitle>
                  <CardDescription>Simulates Kamei et al. empirical JIT classifier trained on 235,888 commits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Slider: Added Lines */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Lines Added (+LOC)</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">+{addedLines}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      step={10}
                      value={addedLines}
                      onChange={(e) => setAddedLines(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {/* Slider: Deleted Lines */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Lines Deleted (-LOC)</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">-{deletedLines}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={500}
                      step={5}
                      value={deletedLines}
                      onChange={(e) => setDeletedLines(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {/* Slider: Modified Files */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Modified Files Count</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">{modifiedFiles} files</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={40}
                      step={1}
                      value={modifiedFiles}
                      onChange={(e) => setModifiedFiles(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {/* Slider: Max Cyclomatic Complexity */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Peak Cyclomatic Complexity v(g)</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">{complexity}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={complexity}
                      onChange={(e) => setComplexity(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {/* Slider: Author Experience */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Author Historical Experience</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">{experience} prior commits</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={150}
                      step={1}
                      value={experience}
                      onChange={(e) => setExperience(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {/* Slider: Directory Entropy */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      <span>Directory Modification Entropy</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">{entropy.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={4.0}
                      step={0.1}
                      value={entropy}
                      onChange={(e) => setEntropy(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <Button
                    onClick={handleSimulateCommit}
                    disabled={commitLoading}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {commitLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Simulate Pull Request Defect Probability
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
                    benchmark="Kamei Empirical Benchmark (ROC-AUC 0.8647)"
                  />

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Identified Commit Risk Drivers</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {commitResult.top_risk_drivers.map((driver, idx) => (
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

        {/* ==================== TAB 3: TEST IMPACT ANALYSIS (DAG TIA) ==================== */}
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

        {/* ==================== TAB 4: KNOWLEDGE SILOS & BUS FACTOR ==================== */}
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
                  {/* Top Stats Banner */}
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
                      {busResult.module_results.slice(0, 10).map((mod, idx) => (
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
                            <span className="font-semibold">Key Owners (80% Frontier):</span> {mod.key_owners.join(', ')}
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
  );
};
