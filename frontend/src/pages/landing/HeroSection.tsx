import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowRight, ShieldCheck, CheckCircle2,
  PlayCircle, ArrowUpRight, TrendingUp, Sparkles, Award
} from 'lucide-react'

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<'overview' | 'commits' | 'debt'>('overview')

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
      {/* Radiant Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 -translate-x-1/2 transform-gpu blur-3xl sm:-top-80">
        <div 
          className="aspect-[1155/678] w-[72rem] bg-gradient-to-tr from-blue-600/30 to-indigo-600/20 opacity-40 dark:opacity-30" 
          style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Hero Header */}
        <div className="mx-auto max-w-3xl text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 dark:border-blue-800/80 bg-blue-50/80 dark:bg-blue-950/50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 dark:bg-blue-400"></span>
            </span>
            <span>Next-Gen Software Intelligence Platform</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline">
              Explore What's New <ArrowUpRight className="h-3 w-3 ml-0.5" />
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Ship High-Quality Code with{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AI Code Intelligence
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            SQDIS automatically inspects your repository commits, evaluates developer quality scores, eliminates technical debt hotspots, and gives engineering leaders instant visibility.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/80 px-6 py-3.5 text-base font-semibold text-slate-800 dark:text-slate-200 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlayCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Explore Live Demo</span>
            </Link>
          </div>

          {/* Trust Points */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>GitHub & GitLab native</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>SOC-2 Type II Certified</span>
            </div>
          </div>
        </div>

        {/* Interactive App Mockup Preview */}
        <div id="preview" className="mt-14 sm:mt-20">
          <div className="relative mx-auto max-w-5xl rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-900/5 dark:bg-[#000000]/90 p-2 shadow-2xl backdrop-blur-xl lg:rounded-3xl">
            {/* Ambient Background Glow for Mockup */}
            <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600/15 via-indigo-600/10 to-cyan-500/15 blur-xl -z-10 opacity-60"></div>

            {/* macOS Browser Chrome Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl bg-slate-100 dark:bg-[#09090b] px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-500/80 shadow-xs"></div>
                <div className="h-3 w-3 rounded-full bg-amber-500/80 shadow-xs"></div>
                <div className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-xs"></div>
              </div>

              {/* URL bar */}
              <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-[#000000] px-3.5 py-1 text-xs text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 w-72 justify-center font-mono shadow-inner">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">https://app.sqdis.io/sprints/24/overview</span>
              </div>

              {/* Interactive tab selector */}
              <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-zinc-900 p-1 rounded-lg text-xs font-medium border border-transparent dark:border-zinc-800">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'overview'
                      ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('commits')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'commits'
                      ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Live Commits
                </button>
                <button
                  onClick={() => setActiveTab('debt')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'debt'
                      ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Tech Debt
                </button>
              </div>
            </div>

            {/* Mockup Dashboard Content */}
            <div className="rounded-b-xl bg-slate-50 dark:bg-[#000000] p-4 sm:p-6 space-y-5 overflow-hidden">
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* Top Stats Row with Micro Sparklines */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Stat 1: Quality Score */}
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#09090b] p-4 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                      <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider">Quality Score</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
                          <TrendingUp className="h-3 w-3" /> +4.8%
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-baseline gap-1">
                            94.2 <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">/ 100</span>
                          </div>
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="h-3 w-3 shrink-0" /> Grade A Standard
                          </p>
                        </div>
                        {/* Micro Sparkline */}
                        <svg className="w-16 h-8 text-emerald-500 shrink-0" viewBox="0 0 64 32" fill="none">
                          <path
                            d="M 2 24 Q 16 22 24 16 T 44 12 T 62 4"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Stat 2: Test Coverage */}
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#09090b] p-4 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                      <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider">Test Coverage</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/50 dark:border-blue-800/40">
                          <TrendingUp className="h-3 w-3" /> +2.1%
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            88.5%
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                            Above target (85%)
                          </p>
                        </div>
                        {/* Micro Sparkline */}
                        <svg className="w-16 h-8 text-blue-500 shrink-0" viewBox="0 0 64 32" fill="none">
                          <path
                            d="M 2 22 Q 18 20 28 14 T 48 10 T 62 6"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Stat 3: PR Velocity */}
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#09090b] p-4 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                      <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider">PR Velocity</span>
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200/50 dark:border-indigo-800/40">
                          1.4h avg
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            92 PRs
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                            Merged this sprint
                          </p>
                        </div>
                        {/* Micro Sparkline */}
                        <svg className="w-16 h-8 text-indigo-500 shrink-0" viewBox="0 0 64 32" fill="none">
                          <path
                            d="M 2 26 Q 16 24 26 18 T 46 8 T 62 6"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Stat 4: Tech Debt */}
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#09090b] p-4 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                      <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider">Tech Debt</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
                          -38%
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            12.4h
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                            Remediation effort
                          </p>
                        </div>
                        {/* Micro Sparkline (Downward is good) */}
                        <svg className="w-16 h-8 text-emerald-500 shrink-0" viewBox="0 0 64 32" fill="none">
                          <path
                            d="M 2 6 Q 16 10 26 16 T 46 22 T 62 26"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Main Showcase Grid: Spline Area Chart + High-Impact Leaderboard */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left: Engineered SVG Spline Area Chart */}
                    <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#09090b] p-4 sm:p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                              Quality Score Trend (SQS)
                            </h4>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded-md border border-cyan-200/50 dark:border-cyan-800/40">
                              <Sparkles className="h-2.5 w-2.5" /> AI Calibrated
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            Real-time quality intelligence across continuous sprint cycles
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-md border border-blue-200/50 dark:border-blue-800/40 shrink-0">
                          Sprint 24 Current
                        </span>
                      </div>

                      {/* SVG Spline & Gradient Area Visualization */}
                      <div className="relative w-full aspect-[21/9] min-h-[180px] sm:min-h-[210px] mt-2">
                        <svg
                          viewBox="0 0 600 200"
                          className="w-full h-full overflow-visible"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            {/* Area Gradient */}
                            <linearGradient id="sqs-hero-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.15" />
                              <stop offset="100%" stopColor="#09090b" stopOpacity="0" />
                            </linearGradient>

                            {/* Line Gradient */}
                            <linearGradient id="sqs-hero-line" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#818cf8" />
                              <stop offset="40%" stopColor="#6366f1" />
                              <stop offset="70%" stopColor="#38bdf8" />
                              <stop offset="100%" stopColor="#06b6d4" />
                            </linearGradient>

                            {/* Glow filter */}
                            <filter id="sqs-hero-glow" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="4" result="blur" />
                              <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                          </defs>

                          {/* Horizontal Grid Baselines */}
                          <line x1="40" y1="35" x2="580" y2="35" stroke="currentColor" strokeDasharray="3 3" className="text-slate-200 dark:text-zinc-800/80" strokeWidth="1" />
                          <line x1="40" y1="80" x2="580" y2="80" stroke="currentColor" strokeDasharray="3 3" className="text-slate-200 dark:text-zinc-800/80" strokeWidth="1" />
                          <line x1="40" y1="125" x2="580" y2="125" stroke="currentColor" strokeDasharray="3 3" className="text-slate-200 dark:text-zinc-800/80" strokeWidth="1" />
                          <line x1="40" y1="170" x2="580" y2="170" stroke="currentColor" className="text-slate-200 dark:text-zinc-800" strokeWidth="1" />

                          {/* Y-Axis Value Labels */}
                          <text x="12" y="38" className="text-[10px] fill-slate-400 dark:fill-zinc-500 font-mono">100</text>
                          <text x="18" y="83" className="text-[10px] fill-slate-400 dark:fill-zinc-500 font-mono">90</text>
                          <text x="18" y="128" className="text-[10px] fill-slate-400 dark:fill-zinc-500 font-mono">80</text>
                          <text x="18" y="173" className="text-[10px] fill-slate-400 dark:fill-zinc-500 font-mono">70</text>

                          {/* Area Fill */}
                          <path
                            d="M 50,145 C 100,140 120,132 170,128 C 220,124 240,105 290,100 C 340,95 360,82 410,75 C 460,68 490,56 550,44 L 550,170 L 50,170 Z"
                            fill="url(#sqs-hero-gradient)"
                          />

                          {/* Glowing Spline Line */}
                          <path
                            d="M 50,145 C 100,140 120,132 170,128 C 220,124 240,105 290,100 C 340,95 360,82 410,75 C 460,68 490,56 550,44"
                            fill="none"
                            stroke="url(#sqs-hero-line)"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#sqs-hero-glow)"
                          />

                          {/* Data Nodes along Curve */}
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
                              fill="#09090b"
                              stroke="#6366f1"
                              strokeWidth="2"
                              className="transition-transform hover:scale-150"
                            />
                          ))}

                          {/* Live Current Focal Node (Sprint 24) */}
                          <circle cx="550" cy="44" r="10" fill="#06b6d4" opacity="0.25" className="animate-ping" />
                          <circle cx="550" cy="44" r="6" fill="#09090b" stroke="#06b6d4" strokeWidth="2.5" />
                          <circle cx="550" cy="44" r="3" fill="#ffffff" />
                        </svg>

                        {/* Floating Live Telemetry Tooltip Pinned at Current Point */}
                        <div className="absolute top-1 sm:top-2 right-4 sm:right-6 bg-slate-900/95 dark:bg-black/95 border border-cyan-500/40 rounded-lg p-2 sm:p-2.5 shadow-xl backdrop-blur-md pointer-events-none">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
                            Sprint 24: <span className="text-cyan-400">94.2 SQS</span>
                          </div>
                          <div className="text-[10px] text-slate-300 dark:text-zinc-400 mt-0.5">
                            +4.8% delta • 0 critical vulnerabilities
                          </div>
                        </div>
                      </div>

                      {/* X-Axis Sprint Timeline Labels */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800/80 text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                        <span>Sprint 19</span>
                        <span>Sprint 20</span>
                        <span>Sprint 21</span>
                        <span>Sprint 22</span>
                        <span>Sprint 23</span>
                        <span className="text-cyan-500 font-bold">Sprint 24 (Live)</span>
                      </div>
                    </div>

                    {/* Right: Enhanced Top Quality Leaders */}
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#09090b] p-4 sm:p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3.5">
                          <div className="flex items-center gap-1.5">
                            <Award className="h-4 w-4 text-amber-500" />
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                              Quality Leaders
                            </h4>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
                            Live Telemetry
                          </span>
                        </div>

                        <div className="space-y-3">
                          {/* Rank 1 */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[10px] font-extrabold w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/40">
                                1
                              </span>
                              <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-bold flex items-center justify-center text-[10px] shadow-sm">
                                AU
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">
                                  Admin User
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                                  Staff Architect
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                                98.4
                              </div>
                              <div className="text-[9px] text-slate-400 dark:text-zinc-500">
                                24 PRs
                              </div>
                            </div>
                          </div>

                          {/* Rank 2 */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[10px] font-extrabold w-4 h-4 rounded-full bg-slate-500/20 text-slate-400 flex items-center justify-center border border-slate-500/40">
                                2
                              </span>
                              <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold flex items-center justify-center text-[10px] shadow-sm">
                                ST
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">
                                  Sarah Teamlead
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                                  Lead Platform Eng
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                                96.1
                              </div>
                              <div className="text-[9px] text-slate-400 dark:text-zinc-500">
                                19 PRs
                              </div>
                            </div>
                          </div>

                          {/* Rank 3 */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[10px] font-extrabold w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/40">
                                3
                              </span>
                              <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold flex items-center justify-center text-[10px] shadow-sm">
                                AD
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">
                                  Alex Developer
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                                  Senior Backend Eng
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                                93.8
                              </div>
                              <div className="text-[9px] text-slate-400 dark:text-zinc-500">
                                15 PRs
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                        <span>8 team engineers</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer">
                          Full Leaderboard →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'commits' && (
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#09090b] p-4 sm:p-5 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        Real-Time Ingested Commits
                      </h4>
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/50 dark:border-blue-800/40">
                        Automated AST Scoring
                      </span>
                    </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                      Webhooks Connected
                    </span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { hash: '7f9a12c', msg: 'refactor(auth): migrate token validation to sliding Redis store', author: 'Sarah Teamlead', score: '96 SQS', tag: 'High Quality', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/50 dark:border-emerald-800/40' },
                      { hash: '4b3d81e', msg: 'feat(reports): add automated PDF sprint export pipeline', author: 'Alex Developer', score: '92 SQS', tag: 'Clean Commit', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200/50 dark:border-blue-800/40' },
                      { hash: '9c2f55a', msg: 'perf(query): optimize AST parser memory footprint by 40%', author: 'Admin User', score: '99 SQS', tag: 'Exemplary', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200/50 dark:border-purple-800/40' },
                      { hash: '2a1b94d', msg: 'test(debt): add regression suite for cyclic dependency detector', author: 'Jordan Smith', score: '91 SQS', tag: 'Well Tested', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/50 dark:border-emerald-800/40' },
                    ].map((item) => (
                      <div key={item.hash} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900/70 transition-colors border border-slate-100 dark:border-zinc-800/60 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <code className="font-mono text-[11px] bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded text-blue-600 dark:text-cyan-400 border border-slate-200 dark:border-zinc-800">
                            {item.hash}
                          </code>
                          <span className="font-medium text-slate-800 dark:text-zinc-200 truncate max-w-[280px] sm:max-w-md">
                            {item.msg}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${item.color}`}>
                            {item.tag}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono">
                            {item.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'debt' && (
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#09090b] p-4 sm:p-5 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        Technical Debt Radar & Remediation
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        Automated AST code smell & complexity identification
                      </p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md border border-emerald-200/50 dark:border-emerald-800/40">
                      0 Critical Blockers
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-lg border border-slate-100 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/50 text-xs space-y-2">
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-zinc-200">
                        <span>Cyclomatic Complexity &gt; 15</span>
                        <span className="text-amber-500 font-bold">2 files identified</span>
                      </div>
                      <p className="text-slate-500 dark:text-zinc-400 leading-relaxed">
                        Heavy nested conditionals detected in legacy parser pipeline.
                      </p>
                      <div className="pt-2 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-medium border-t border-slate-200/60 dark:border-zinc-800">
                        <span>Target: Sprint 25</span>
                        <span>Estimated: ~3.5h</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-100 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/50 text-xs space-y-2">
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-zinc-200">
                        <span>Dead Code & Unused Exports</span>
                        <span className="text-emerald-500 font-bold">100% Resolved</span>
                      </div>
                      <p className="text-slate-500 dark:text-zinc-400 leading-relaxed">
                        Tree-shaking analysis verified across all production bundles.
                      </p>
                      <div className="pt-2 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium border-t border-slate-200/60 dark:border-zinc-800">
                        <span>Clean state</span>
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
