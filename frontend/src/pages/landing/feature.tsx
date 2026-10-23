import { 
  Cpu, GitPullRequest, AlertTriangle, 
  Users, Shield, CheckCircle2, Lock, Zap
} from 'lucide-react'

type Props = {
  id?: string
}

export default function Feature({ id = 'features' }: Props) {
  return (
    <section id={id} className="py-20 lg:py-28 scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 uppercase tracking-wider">
            Platform Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Engineered for Deep Code Intelligence.
          </h2>
          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            Moving beyond surface-level linters. SQDIS inspects abstract syntax trees, calculates cyclomatic depth, and automates engineering governance.
          </p>
        </div>

        {/* Asymmetric Engineering Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
          {/* BENTO 1: Polyglot AST Engine (Large - 2 cols) */}
          <div className="md:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-indigo-500 uppercase tracking-wider">
                  <Cpu className="h-4 w-4" />
                  <span>Core AST Engine</span>
                </div>
                <span className="rounded px-2 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                  Tree-sitter Native
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Polyglot AST & Cyclomatic Complexity Analysis
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                Continuous in-memory syntax tree parsing across TypeScript, Python, Go, Java, and Rust. Evaluates nested condition depth, cognitive branch load, and architectural couplings per function.
              </p>
            </div>

            {/* Embedded Code Diff Visualizer */}
            <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-200 p-3.5 font-mono text-[11px] space-y-1.5 overflow-x-auto shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[10px] text-zinc-400">
                <span>src/auth/token-service.ts</span>
                <span className="text-emerald-400">Cyclomatic: 3 (Reduced from 11)</span>
              </div>
              <div className="text-zinc-500">@@ -42,7 +42,9 @@ export class TokenManager &#123;</div>
              <div className="text-rose-400/90 bg-rose-950/30 px-1 py-0.5 rounded">-   if (auth &amp;&amp; !isRevoked &amp;&amp; (token.exp &gt; now || fallback)) &#123;</div>
              <div className="text-emerald-400/90 bg-emerald-950/30 px-1 py-0.5 rounded">+   if (this.isValidSession(auth, token, now)) &#123;</div>
              <div className="text-zinc-400 px-1">       return this.dispatchClaims(token);</div>
              <div className="text-zinc-400 px-1">     &#125;</div>
            </div>
          </div>

          {/* BENTO 2: Automated PR Quality Gates (1 col) */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-emerald-500 uppercase tracking-wider">
                <GitPullRequest className="h-4 w-4" />
                <span>Merge Governance</span>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Automated PR Quality Gates
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Block architectural regressions before merging. Enforce SQS score floors, coverage thresholds, and zero blocker policies.
              </p>
            </div>

            <div className="mt-6 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-emerald-500 font-semibold text-[11px]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> GitHub Checks: Passed
                </span>
                <span>380ms</span>
              </div>
              <div className="space-y-1 text-[10px] text-zinc-500">
                <div className="flex justify-between"><span>SQS Quality Score</span><span className="text-zinc-300">94.2 (&gt;= 85)</span></div>
                <div className="flex justify-between"><span>Coverage Delta</span><span className="text-zinc-300">+2.1% (&gt;= 0%)</span></div>
                <div className="flex justify-between"><span>High Risk Smells</span><span className="text-zinc-300">0 detected</span></div>
              </div>
            </div>
          </div>

          {/* BENTO 3: Sub-500ms Webhook Engine (1 col) */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-amber-500 uppercase tracking-wider">
                <Zap className="h-4 w-4" />
                <span>Zero Latency</span>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Sub-500ms Webhooks
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                HMAC-SHA256 verified event capture. Asynchronous worker threads index commits and update scores without blocking CI queues.
              </p>
            </div>

            <div className="mt-6 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-1.5 font-mono text-[10px]">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Webhook Ingestion Rate</span>
                <span className="text-amber-500 font-bold">1,240 events/sec</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Mean Queue Time</span>
                <span className="text-emerald-500 font-bold">14ms</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>HMAC Signature</span>
                <span className="text-zinc-300 font-mono">SHA256 Verified</span>
              </div>
            </div>
          </div>

          {/* BENTO 4: Tech Debt Radar (Large - 2 cols) */}
          <div className="md:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-cyan-500 uppercase tracking-wider">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Debt Identification</span>
                </div>
                <span className="rounded px-2 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                  Effort Estimation
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Technical Debt Radar & Remediation Effort
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                Automatically locate monolithic functions, duplicate clone blocks, and cyclic imports. SQDIS provides realistic hour estimates so teams can schedule debt cleanup in sprint backlogs.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 space-y-1">
                <div className="flex justify-between font-semibold text-zinc-800 dark:text-zinc-200">
                  <span>Monolithic Function</span>
                  <span className="text-amber-500">High Risk</span>
                </div>
                <div className="text-[11px] text-zinc-500">packages/core/src/parser.ts:184</div>
                <div className="text-[10px] text-indigo-400 pt-1">Estimated effort: ~3.5 hours</div>
              </div>

              <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 space-y-1">
                <div className="flex justify-between font-semibold text-zinc-800 dark:text-zinc-200">
                  <span>Cyclic Import Hotspot</span>
                  <span className="text-cyan-400">Medium Risk</span>
                </div>
                <div className="text-[11px] text-zinc-500">services/auth &lt;-&gt; services/user</div>
                <div className="text-[10px] text-indigo-400 pt-1">Estimated effort: ~1.5 hours</div>
              </div>
            </div>
          </div>

          {/* BENTO 5: Developer Quality Scores (1 col) */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-purple-400 uppercase tracking-wider">
                <Users className="h-4 w-4" />
                <span>Fair Metrics</span>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Developer Quality Scores (DQS)
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Reward craftsmanship over commit volume. Normalized scoring accounts for file complexity, test rigor, and refactoring impact.
              </p>
            </div>

            <div className="mt-6 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-[11px]">Fair Commit Attribution</span>
                <span className="text-emerald-500 font-bold">Top 5%</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[94%]" />
              </div>
              <div className="text-[10px] text-zinc-500 text-right">
                94.8 Calibrated DQS Score
              </div>
            </div>
          </div>

          {/* BENTO 6: Ephemeral AST & Metadata-Only Storage (Large - 2 cols) */}
          <div className="md:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-emerald-500 uppercase tracking-wider">
                  <Shield className="h-4 w-4" />
                  <span>Architecture Security</span>
                </div>
                <span className="rounded px-2 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                  Zero File Storage
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Ephemeral In-Memory AST Parsing & Metadata-Only Storage
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                Your repository files are never written to disk or cloned to permanent volumes. Tree-sitter parses the commit diff ephemerally in worker memory, persists only computed complexity metrics and commit SHAs to PostgreSQL, and immediately frees raw code from RAM.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
              <div className="p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300">RAM-Only AST Worker</span>
              </div>
              <div className="p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300">Zero File Persistence</span>
              </div>
              <div className="p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300">Postgres Metadata Only</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
