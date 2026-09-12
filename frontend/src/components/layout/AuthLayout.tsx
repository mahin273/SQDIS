import { Outlet, Link } from 'react-router-dom'
import { 
  Activity, 
  GitCommit, 
  CheckCircle2, 
  Sparkles,
  Lock,
  ArrowUpRight
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[#06090f] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* =========================================================================
          GLOBAL UNIFIED ATMOSPHERIC CANVAS (Seamless across entire screen)
          ========================================================================= */}
      {/* 1. Global Subtle Dot Matrix */}
      <div 
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#6366f1 1.2px, transparent 1.2px)`,
          backgroundSize: '28px 28px'
        }}
      />

      {/* 2. Global Ambient Radial Lighting Mesh */}
      <div className="absolute -top-32 -left-32 h-[650px] w-[650px] rounded-full bg-blue-600/[0.12] blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 -right-20 -translate-y-1/2 h-[650px] w-[650px] rounded-full bg-indigo-600/[0.12] blur-[150px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 h-[550px] w-[550px] rounded-full bg-violet-600/[0.09] blur-[140px] pointer-events-none" />

      {/* 3. Subtle Vignette Edge Mask */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#06090f]/60 via-transparent to-[#06090f]/40 pointer-events-none" />

      {/* =========================================================================
          PAGE CONTENT: 2-Column Responsive Layout with Soft Fading Divider
          ========================================================================= */}
      <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 relative z-10">
        {/* -----------------------------------------------------------------------
            LEFT COLUMN: Live Quality Intelligence Showcase
            ----------------------------------------------------------------------- */}
        <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between p-10 xl:p-16 relative">
          {/* Subtle Fading Center Divider (No harsh vertical cut!) */}
          <div className="absolute right-0 top-16 bottom-16 w-px bg-gradient-to-b from-transparent via-slate-800/70 to-transparent pointer-events-none" />

          {/* Top Brand Bar */}
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center group transition-transform duration-200 hover:scale-[1.02]">
              <Logo size="lg" variant="neural" />
            </Link>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-300 backdrop-blur-md">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Platform v2.5 Online
            </div>
          </div>

          {/* Center Showcase Content */}
          <div className="my-auto py-8 space-y-7 max-w-xl">
            {/* Headline */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-indigo-400">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                Software Quality & Developer Insight System
              </div>
              <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Turn commit telemetry into <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400">engineering velocity</span>.
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
                Automated DQS scoring, AST cyclomatic complexity analysis, and predictive defect risk across your team's code repositories.
              </p>
            </div>

            {/* Glassmorphic Quality Card Preview */}
            <div className="rounded-2xl bg-slate-900/60 backdrop-blur-2xl border border-white/[0.08] border-t-white/[0.18] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] space-y-4">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      mahin273/SQDIS
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">main</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Live Quality Telemetry Feed</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Gate Passed
                </span>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-950/60 border border-white/[0.05] p-3">
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Dev Quality (DQS)</div>
                  <div className="text-xl font-bold text-white mt-0.5 flex items-baseline gap-1">
                    94.2
                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center">
                      +3.4% <ArrowUpRight className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <div className="text-[9px] text-indigo-400 mt-1 font-medium">Top 5% Engineer Tier</div>
                </div>

                <div className="rounded-xl bg-slate-950/60 border border-white/[0.05] p-3">
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Maintainability</div>
                  <div className="text-xl font-bold text-cyan-400 mt-0.5">
                    91<span className="text-xs text-slate-400 font-normal">/100</span>
                  </div>
                  <div className="text-[9px] text-cyan-400 mt-1 font-medium">Grade A+ (McCabe &lt; 8)</div>
                </div>

                <div className="rounded-xl bg-slate-950/60 border border-white/[0.05] p-3">
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Test Coverage</div>
                  <div className="text-xl font-bold text-violet-400 mt-0.5">
                    88.5%
                  </div>
                  <div className="text-[9px] text-emerald-400 mt-1 font-medium">+4.2% this sprint</div>
                </div>
              </div>

              {/* Micro Live Commit Trace */}
              <div className="space-y-2 pt-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
                  <span>Recent Inspected Commits</span>
                  <span className="text-[10px] text-slate-400 font-normal">Scored by Quality Engine</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/40 border border-white/[0.04]">
                    <div className="flex items-center gap-2 truncate">
                      <GitCommit className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-200 truncate font-mono text-[11px]">feat(quality): code analysis engine verified</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-400 shrink-0 ml-2">Score: 98</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/40 border border-white/[0.04]">
                    <div className="flex items-center gap-2 truncate">
                      <GitCommit className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span className="text-slate-200 truncate font-mono text-[11px]">fix(auth): rotate JWT refresh sessions</span>
                    </div>
                    <span className="text-[10px] font-semibold text-blue-400 shrink-0 ml-2">Score: 92</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Proof Stats */}
            <div className="pt-2 flex items-center gap-6 text-xs text-slate-400 border-t border-slate-800/60">
              <div>
                <span className="font-bold text-white text-sm">250,000+</span>
                <span className="block text-[11px] text-slate-400">Inspected changesets</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="font-bold text-white text-sm">100% On-Premise</span>
                <span className="block text-[11px] text-slate-400">Zero 3rd-party code leaks</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="font-bold text-white text-sm">Deep Analysis</span>
                <span className="block text-[11px] text-slate-400">Transparent Risk Drivers</span>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-4">
            <div>&copy; {new Date().getFullYear()} SQDIS Quality Platform.</div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Lock className="h-3.5 w-3.5 text-indigo-400" />
              <span>End-to-End Enterprise Encryption</span>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------------
            RIGHT COLUMN: The Auth Chamber (Floating Glass Card)
            ----------------------------------------------------------------------- */}
        <div className="col-span-1 lg:col-span-6 xl:col-span-5 flex flex-col justify-center items-center p-6 sm:p-12">
          {/* Mobile Header Logo */}
          <div className="flex lg:hidden justify-center mb-8">
            <Link to="/" className="inline-flex items-center">
              <Logo size="md" variant="neural" />
            </Link>
          </div>

          {/* Card Mount Container */}
          <div className="w-full max-w-[440px]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
