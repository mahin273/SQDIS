import { Outlet, Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { Shield, Lock, Cpu, CheckCircle2 } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full bg-[#08090d] text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12">
        {/* =====================================================================
            LEFT COLUMN (Col 7): The Engineering & Quality Telemetry Console
            ===================================================================== */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-10 xl:p-14 border-r border-zinc-800/60 bg-[#07080c] relative overflow-hidden">
          {/* Subtle Ambient Illumination */}
          <div 
            className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/[0.04] blur-3xl pointer-events-none" 
          />

          {/* Top Brand */}
          <div className="flex items-center justify-between relative z-10">
            <Link to="/" className="inline-flex items-center group transition-opacity hover:opacity-90">
              <Logo size="lg" variant="neural" />
            </Link>
          </div>

          {/* Centerpiece Showcase */}
          <div className="my-auto py-8 space-y-6 max-w-xl relative z-10">
            {/* Header copy */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-indigo-400 uppercase tracking-wider">
                <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                <span>Continuous Software Quality Intelligence</span>
              </div>
              <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-zinc-100 leading-tight">
                Turn codebase telemetry into predictable velocity.
              </h1>
              <p className="text-xs xl:text-sm text-zinc-400 leading-relaxed">
                Automated Developer Quality Scoring (DQS), AST cyclomatic complexity analysis, and defect risk telemetry across your repositories.
              </p>
            </div>

            {/* High-Precision Telemetry HUD Console */}
            <div className="rounded-xl border border-zinc-800 bg-[#0c0e15] shadow-2xl overflow-hidden">
              {/* Terminal Titlebar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/70" />
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 ml-2">telemetry://ast-engine/inspect.live</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Gate: Passed</span>
                </div>
              </div>

              {/* Metric Cards Row */}
              <div className="grid grid-cols-3 gap-px bg-zinc-800/60 p-px">
                <div className="bg-[#0c0e15] p-3.5 space-y-1">
                  <div className="text-[10px] uppercase font-mono text-zinc-400">DQS Quality Score</div>
                  <div className="text-xl font-bold font-mono text-white flex items-baseline gap-1">
                    94.2
                    <span className="text-[10px] text-emerald-400 font-sans flex items-center">+3.4%</span>
                  </div>
                  <div className="text-[9px] text-zinc-400 font-mono">Top Percentile Tier</div>
                </div>

                <div className="bg-[#0c0e15] p-3.5 space-y-1">
                  <div className="text-[10px] uppercase font-mono text-zinc-400">Cyclomatic Index</div>
                  <div className="text-xl font-bold font-mono text-zinc-100">
                    4.8<span className="text-xs text-zinc-400 font-normal"> /15</span>
                  </div>
                  <div className="text-[9px] text-zinc-400 font-mono">McCabe Complexity: Low</div>
                </div>

                <div className="bg-[#0c0e15] p-3.5 space-y-1">
                  <div className="text-[10px] uppercase font-mono text-zinc-400">Portfolio Coverage</div>
                  <div className="text-xl font-bold font-mono text-zinc-100">
                    88.5%
                  </div>
                  <div className="text-[9px] text-emerald-400 font-mono">Line-weighted verified</div>
                </div>
              </div>

              {/* Monospace Telemetry Trace Log */}
              <div className="p-4 bg-zinc-950/70 font-mono text-[11px] space-y-1.5 border-t border-zinc-800/60">
                <div className="flex items-center justify-between text-zinc-400 pb-1 border-b border-zinc-900 text-[10px] uppercase">
                  <span>Live Inspection Log</span>
                  <span>Cluster: us-east-prod</span>
                </div>
                <div className="text-zinc-400 flex items-start gap-2">
                  <span className="text-zinc-600 select-none">01</span>
                  <span className="text-zinc-400">[ast-parser] AST traverse complete: 1,420 syntax nodes verified</span>
                </div>
                <div className="text-zinc-400 flex items-start gap-2">
                  <span className="text-zinc-600 select-none">02</span>
                  <span className="text-zinc-400">[cyclomatic] max_branch_factor: 5 &lt;= 15 threshold [OK]</span>
                </div>
                <div className="text-zinc-400 flex items-start gap-2">
                  <span className="text-emerald-400">[defect-risk] SHAP inference calculated: 0.042 (Low Risk)</span>
                </div>
                <div className="text-zinc-400 flex items-start gap-2">
                  <span className="text-zinc-300">[quality-gate] Policy evaluation passed for deployment</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust & Compliance Strip */}
          <div className="flex items-center justify-between text-xs text-zinc-400 pt-6 border-t border-zinc-800/60 relative z-10">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-zinc-400" />
              <span>HMAC-SHA256 Verified</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-zinc-400" />
              <span>Metadata-Only AST</span>
            </div>
            <div>
              <span>&copy; {new Date().getFullYear()} SQDIS</span>
            </div>
          </div>
        </div>

        {/* =====================================================================
            RIGHT COLUMN (Col 5): The Precision Auth Chamber
            ===================================================================== */}
        <div className="col-span-12 lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-[#090a0f] min-h-screen">
          {/* Mobile Top Header (hidden on desktop) */}
          <div className="flex lg:hidden justify-center pt-4 pb-6">
            <Link to="/" className="inline-flex items-center">
              <Logo size="md" variant="neural" />
            </Link>
          </div>

          {/* Centered Auth Card Container */}
          <div className="w-full max-w-sm mx-auto my-auto py-4">
            <Outlet />
          </div>

          {/* Subdued Mobile/Desktop Right Footer */}
          <div className="w-full max-w-sm mx-auto flex items-center justify-between text-[11px] text-zinc-400 pt-6">
            <span>Enterprise Security</span>
            <div className="flex items-center gap-3">
              <Link to="/" className="hover:text-zinc-300 transition-colors">Home</Link>
              <span className="text-zinc-700">&bull;</span>
              <a href="https://github.com/mahin273/SQDIS" target="_blank" rel="noreferrer" className="hover:text-zinc-300 transition-colors">GitHub</a>
              <span className="text-zinc-700">&bull;</span>
              <span className="text-zinc-400">Status</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
