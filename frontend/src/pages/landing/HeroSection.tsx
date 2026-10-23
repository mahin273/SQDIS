import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowRight, ShieldCheck, CheckCircle2,
  Lock, Zap, GitPullRequest, GitCommit,
  Sparkles, Award, Terminal
} from 'lucide-react'

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<'overview' | 'commits' | 'gates' | 'debt'>('overview')

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
      {/* Subtle Ambient Radial Illumination */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 -translate-x-1/2 w-[72rem] h-[36rem] rounded-full bg-indigo-600/[0.04] blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Hero Header */}
        <div className="mx-auto max-w-3xl text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#0c0e15] px-3.5 py-1.5 text-xs font-mono text-zinc-700 dark:text-zinc-300 shadow-xs backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Continuous Code Intelligence & Telemetry</span>
            <span className="text-zinc-400 dark:text-zinc-600">|</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">Tree-sitter AST Calibrated</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-[1.12]">
            Quantify Code Quality at the{' '}
            <span className="text-zinc-500 dark:text-zinc-400">
              AST Level.
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            SQDIS inspects repository commits in memory, measures cyclomatic complexity, enforces automated PR quality gates, and eliminates architectural debt before merge.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 px-6 py-3 text-sm font-semibold text-white dark:text-zinc-900 shadow-sm transition-all"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Connect with GitHub</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <a
              href="#telemetry"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] hover:bg-zinc-100 dark:hover:bg-zinc-800/60 px-6 py-3 text-sm font-mono font-medium text-zinc-700 dark:text-zinc-300 shadow-xs transition-all"
            >
              <Terminal className="h-4 w-4 text-zinc-400" />
              <span>Explore Live Telemetry</span>
            </a>
          </div>

          {/* Trust Points */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>SOC-2 Type II Certified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-indigo-400" />
              <span>Ephemeral In-Memory AST (Zero Code Retained)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Sub-500ms Webhook SLA</span>
            </div>
          </div>
        </div>

        {/* Central High-Precision Telemetry Console HUD */}
        <div id="telemetry" className="mt-14 sm:mt-20 scroll-mt-24">
          <div className="relative mx-auto max-w-5xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] shadow-2xl overflow-hidden">
            {/* Ambient console back-glow */}
            <div className="pointer-events-none absolute -inset-1 rounded-xl bg-indigo-500/[0.03] blur-xl -z-10" />

            {/* Terminal Titlebar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                </div>
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 ml-2">
                  sqdis://telemetry/ast-engine/sprint-24
                </span>
              </div>

              {/* Interactive tab selector */}
              <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-950 p-1 rounded-lg text-xs font-mono">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'overview'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  AST Telemetry
                </button>
                <button
                  onClick={() => setActiveTab('commits')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'commits'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Live Commits
                </button>
                <button
                  onClick={() => setActiveTab('gates')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'gates'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  PR Quality Gate
                </button>
                <button
                  onClick={() => setActiveTab('debt')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'debt'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Debt Radar
                </button>
              </div>

              {/* Status indicator */}
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Gate: Passed</span>
              </div>
            </div>

            {/* Console Content */}
            <div className="p-4 sm:p-6 space-y-5">
              {/* TAB 1: AST Telemetry */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* Top Stats Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                        <span className="text-[10px] uppercase font-mono tracking-wider">Quality Score</span>
                        <span className="text-[10px] font-mono font-medium text-emerald-500">+4.8%</span>
                      </div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white">
                        94.2 <span className="text-xs text-zinc-400 font-normal">/ 100</span>
                      </div>
                      <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Grade A Standard
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                        <span className="text-[10px] uppercase font-mono tracking-wider">Test Coverage</span>
                        <span className="text-[10px] font-mono font-medium text-indigo-400">+2.1%</span>
                      </div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white">
                        88.5%
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        Target floor: 85.0%
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                        <span className="text-[10px] uppercase font-mono tracking-wider">PR Velocity</span>
                        <span className="text-[10px] font-mono font-medium text-zinc-400">1.4h avg</span>
                      </div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white">
                        92 PRs
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        Merged this cycle
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                        <span className="text-[10px] uppercase font-mono tracking-wider">Tech Debt</span>
                        <span className="text-[10px] font-mono font-medium text-emerald-500">-38%</span>
                      </div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white">
                        12.4h
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        Remediation effort
                      </div>
                    </div>
                  </div>

                  {/* Main Grid: Spline Area Chart + Quality Leaders */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Spline Area Chart */}
                    <div className="lg:col-span-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 sm:p-5 flex flex-col justify-between">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-mono font-bold text-zinc-900 dark:text-white">
                              Quality Score Trend (SQS)
                            </h4>
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/40">
                              <Sparkles className="h-2.5 w-2.5" /> AST Grounded
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Real-time quality intelligence across continuous sprint cycles
                          </p>
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-1 rounded">
                          Sprint 24 Current
                        </span>
                      </div>

                      {/* SVG Spline & Gradient Area Visualization */}
                      <div className="relative w-full aspect-[21/9] min-h-[180px] sm:min-h-[200px] mt-2">
                        <svg
                          viewBox="0 0 600 200"
                          className="w-full h-full overflow-visible"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <linearGradient id="sqs-obsidian-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                              <stop offset="60%" stopColor="#6366f1" stopOpacity="0.08" />
                              <stop offset="100%" stopColor="#0c0e15" stopOpacity="0" />
                            </linearGradient>

                            <linearGradient id="sqs-obsidian-line" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#818cf8" />
                              <stop offset="50%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#38bdf8" />
                            </linearGradient>
                          </defs>

                          {/* Grid Baselines */}
                          <line x1="40" y1="35" x2="580" y2="35" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" />
                          <line x1="40" y1="80" x2="580" y2="80" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" />
                          <line x1="40" y1="125" x2="580" y2="125" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" />
                          <line x1="40" y1="170" x2="580" y2="170" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" />

                          {/* Y-Axis Value Labels */}
                          <text x="14" y="38" className="text-[10px] fill-zinc-400 font-mono">100</text>
                          <text x="20" y="83" className="text-[10px] fill-zinc-400 font-mono">90</text>
                          <text x="20" y="128" className="text-[10px] fill-zinc-400 font-mono">80</text>
                          <text x="20" y="173" className="text-[10px] fill-zinc-400 font-mono">70</text>

                          {/* Area Fill */}
                          <path
                            d="M 50,145 C 100,140 120,132 170,128 C 220,124 240,105 290,100 C 340,95 360,82 410,75 C 460,68 490,56 550,44 L 550,170 L 50,170 Z"
                            fill="url(#sqs-obsidian-gradient)"
                          />

                          {/* Spline Line */}
                          <path
                            d="M 50,145 C 100,140 120,132 170,128 C 220,124 240,105 290,100 C 340,95 360,82 410,75 C 460,68 490,56 550,44"
                            fill="none"
                            stroke="url(#sqs-obsidian-line)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Data Nodes */}
                          {[
                            { x: 50, y: 145 },
                            { x: 170, y: 128 },
                            { x: 290, y: 100 },
                            { x: 410, y: 75 },
                          ].map((pt, i) => (
                            <circle
                              key={i}
                              cx={pt.x}
                              cy={pt.y}
                              r="3.5"
                              fill="#0c0e15"
                              stroke="#6366f1"
                              strokeWidth="2"
                            />
                          ))}

                          {/* Live Current Node (Sprint 24) */}
                          <circle cx="550" cy="44" r="8" fill="#38bdf8" opacity="0.2" className="animate-ping" />
                          <circle cx="550" cy="44" r="5" fill="#0c0e15" stroke="#38bdf8" strokeWidth="2" />
                          <circle cx="550" cy="44" r="2.5" fill="#ffffff" />
                        </svg>

                        {/* Floating Live Telemetry Tooltip */}
                        <div className="absolute top-1 right-4 sm:right-6 bg-zinc-900/95 dark:bg-black/95 border border-zinc-700 dark:border-zinc-800 rounded-md p-2 shadow-xl pointer-events-none">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            Sprint 24: <span className="text-cyan-400">94.2 SQS</span>
                          </div>
                          <div className="text-[9px] font-mono text-zinc-400 mt-0.5">
                            +4.8% delta | 0 critical hotspots
                          </div>
                        </div>
                      </div>

                      {/* X-Axis Sprint Timeline Labels */}
                      <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-400">
                        <span>Sprint 19</span>
                        <span>Sprint 20</span>
                        <span>Sprint 21</span>
                        <span>Sprint 22</span>
                        <span>Sprint 23</span>
                        <span className="text-cyan-500 font-semibold">Sprint 24 (Live)</span>
                      </div>
                    </div>

                    {/* Quality Leaders */}
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 sm:p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <Award className="h-3.5 w-3.5 text-zinc-400" />
                            <h4 className="text-xs font-mono font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                              Quality Roster
                            </h4>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500">DQS Metric</span>
                        </div>

                        <div className="space-y-2">
                          {[
                            { rank: '1', name: 'Admin User', role: 'Staff Architect', score: '98.4', prs: '24 PRs', initial: 'AU' },
                            { rank: '2', name: 'Sarah Teamlead', role: 'Lead Platform Eng', score: '96.1', prs: '19 PRs', initial: 'ST' },
                            { rank: '3', name: 'Alex Developer', role: 'Senior Backend Eng', score: '93.8', prs: '15 PRs', initial: 'AD' },
                          ].map((item) => (
                            <div key={item.rank} className="flex items-center justify-between p-2 rounded-md bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-mono font-bold w-4 text-center text-zinc-400">
                                  {item.rank}
                                </span>
                                <div className="h-6 w-6 rounded bg-zinc-800 text-zinc-200 font-mono font-bold flex items-center justify-center text-[9px]">
                                  {item.initial}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-200 truncate">
                                    {item.name}
                                  </div>
                                  <div className="text-[9px] font-mono text-zinc-500 truncate">
                                    {item.role}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-mono font-bold text-xs text-emerald-500">
                                  {item.score}
                                </div>
                                <div className="text-[9px] font-mono text-zinc-500">
                                  {item.prs}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
                        <span>8 active contributors</span>
                        <span className="text-indigo-400 font-medium">Verified Commits</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Live Ingested Commits */}
              {activeTab === 'commits' && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <GitCommit className="h-4 w-4 text-zinc-400" />
                      <h4 className="text-xs font-mono font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                        Real-Time Ingested Commits
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      HMAC Webhooks Active
                    </span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { hash: '7f9a12c', msg: 'refactor(auth): migrate token validation to sliding Redis store', author: 'Sarah Teamlead', score: '96 SQS', tag: 'High Quality', color: 'text-emerald-500 border-emerald-800/40 bg-emerald-950/20' },
                      { hash: '4b3d81e', msg: 'feat(reports): add automated PDF sprint export pipeline', author: 'Alex Developer', score: '92 SQS', tag: 'Clean Commit', color: 'text-indigo-400 border-indigo-800/40 bg-indigo-950/20' },
                      { hash: '9c2f55a', msg: 'perf(query): optimize AST parser memory footprint by 40%', author: 'Admin User', score: '99 SQS', tag: 'Exemplary', color: 'text-cyan-400 border-cyan-800/40 bg-cyan-950/20' },
                      { hash: '2a1b94d', msg: 'test(debt): add regression suite for cyclic dependency detector', author: 'Jordan Smith', score: '91 SQS', tag: 'Well Tested', color: 'text-emerald-500 border-emerald-800/40 bg-emerald-950/20' },
                    ].map((item) => (
                      <div key={item.hash} className="flex items-center justify-between p-2.5 rounded-md bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <code className="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                            {item.hash}
                          </code>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[280px] sm:max-w-md">
                            {item.msg}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${item.color}`}>
                            {item.tag}
                          </span>
                          <span className="font-bold text-zinc-900 dark:text-white font-mono tabular-nums">
                            {item.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: PR Quality Gate */}
              {activeTab === 'gates' && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="h-4 w-4 text-indigo-400" />
                      <div>
                        <h4 className="text-xs font-mono font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                          PR Gate Policy Evaluation
                        </h4>
                        <p className="text-[11px] font-mono text-zinc-500">
                          Pull Request #142: refactor(cache): implement distributed token sliding window
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded">
                      Checks Passed (Ready to Merge)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { rule: 'Cyclomatic Complexity Threshold', condition: 'Max function depth <= 12', actual: 'Depth: 4', status: 'PASS' },
                      { rule: 'Test Coverage Delta', condition: 'Coverage drop <= 0.0%', actual: 'Delta: +2.4%', status: 'PASS' },
                      { rule: 'Critical AST Smells', condition: '0 high-severity smells', actual: '0 detected', status: 'PASS' },
                      { rule: 'Overall Software Quality Score', condition: 'SQS Score >= 85.0', actual: 'Score: 94.2', status: 'PASS' },
                    ].map((gate, i) => (
                      <div key={i} className="p-3 rounded-md bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                          <span>{gate.rule}</span>
                          <span className="text-emerald-500 font-bold">{gate.status}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {gate.condition}
                        </div>
                        <div className="text-[10px] text-indigo-400 font-mono pt-1">
                          Evaluated: {gate.actual}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: Debt Radar */}
              {activeTab === 'debt' && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div>
                      <h4 className="text-xs font-mono font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                        Technical Debt Radar & Remediation
                      </h4>
                      <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                        Automated AST code smell & cyclomatic hotspot identification
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded">
                      0 Critical Blockers
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-md bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                        <span>Cyclomatic Complexity &gt; 15</span>
                        <span className="text-amber-500 font-bold font-mono">2 files flagged</span>
                      </div>
                      <p className="text-zinc-500 text-[11px] leading-relaxed">
                        Nested branching detected in legacy AST worker serialization routine.
                      </p>
                      <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-indigo-400 border-t border-zinc-200 dark:border-zinc-800">
                        <span>Sprint 25 Remediation</span>
                        <span>Estimated: ~3.5h</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-md bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                        <span>Unused Exports & Dead AST Nodes</span>
                        <span className="text-emerald-500 font-bold font-mono">100% Resolved</span>
                      </div>
                      <p className="text-zinc-500 text-[11px] leading-relaxed">
                        Tree-shaking analysis verified across all monorepo export declarations.
                      </p>
                      <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-emerald-500 border-t border-zinc-200 dark:border-zinc-800">
                        <span>Clean baseline</span>
                        <span>0h effort</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
