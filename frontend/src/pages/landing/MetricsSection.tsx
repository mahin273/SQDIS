import { ShieldCheck, GitPullRequest, TrendingDown, Zap } from 'lucide-react'

export default function MetricsSection() {
  const stats = [
    {
      value: '94.8%',
      label: 'Average Quality SQS',
      description: 'Maintained across production repositories',
      icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
      tag: 'Calibrated',
    },
    {
      value: '3.5x',
      label: 'Accelerated PR Cycles',
      description: 'Automated gates eliminate manual review gridlock',
      icon: <GitPullRequest className="h-4 w-4 text-indigo-400" />,
      tag: 'Efficiency',
    },
    {
      value: '42%',
      label: 'Less Technical Debt',
      description: 'Proactive detection at the AST commit level',
      icon: <TrendingDown className="h-4 w-4 text-cyan-400" />,
      tag: 'Reduction',
    },
    {
      value: '< 500ms',
      label: 'Webhook Latency',
      description: 'Instant Tree-sitter AST parsing and score emit',
      icon: <Zap className="h-4 w-4 text-amber-500" />,
      tag: 'Sub-Second',
    },
  ]

  return (
    <section className="border-y border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/60 dark:bg-[#07080c] py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0c0e15] p-5 shadow-xs transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="rounded-md bg-zinc-100 dark:bg-zinc-800/80 p-2">
                  {stat.icon}
                </div>
                <span className="rounded px-2 py-0.5 text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
                  {stat.tag}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-100 tracking-tight">
                {stat.value}
              </div>
              <div className="text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-300 mt-1">
                {stat.label}
              </div>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
