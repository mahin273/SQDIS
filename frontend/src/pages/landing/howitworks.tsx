import { GitBranch, Cpu, Database, CheckCircle2 } from 'lucide-react'

type Props = {
  id?: string
}

export default function HowItWorks({ id = 'how-it-works' }: Props) {
  const steps = [
    {
      step: '01',
      icon: <GitBranch className="h-5 w-5 text-indigo-400" />,
      title: 'Repository Webhook Ingest',
      description: 'GitHub or GitLab dispatches signed HMAC-SHA256 push or pull request events to our webhook gateway in milliseconds.',
      details: ['Zero developer workstation setup', 'Mono-repo and submodule support', 'Instant HMAC signature validation'],
    },
    {
      step: '02',
      icon: <Cpu className="h-5 w-5 text-cyan-400" />,
      title: 'In-Memory Polyglot AST Parsing',
      description: 'Worker instances parse modified files using Tree-sitter into abstract syntax trees directly in RAM without saving code to disk.',
      details: ['Tree-sitter AST traversal', 'Cyclomatic branch depth calculation', 'Cognitive complexity analysis'],
    },
    {
      step: '03',
      icon: <Database className="h-5 w-5 text-purple-400" />,
      title: 'ML Calibration & SQS Scoring',
      description: 'Pre-trained models benchmark code complexity against repository historical baselines and calculate normalized SQS quality scores.',
      details: ['0-100 normalized SQS score', 'Hotspot detection & smell tagging', 'Remediation effort estimation'],
    },
    {
      step: '04',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      title: 'PR Quality Gates & Telemetry',
      description: 'Status checks are written directly to GitHub PRs via the Checks API, while live telemetry updates executive dashboards.',
      details: ['GitHub Checks API pass/block', 'WebSocket live monitor updates', 'Slack and email threshold alerts'],
    },
  ]

  return (
    <section id={id} className="border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/60 dark:bg-[#07080c] py-20 lg:py-28 scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 uppercase tracking-wider">
            Architecture Pipeline
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            How SQDIS Analyzes Every Commit in Real Time.
          </h2>
          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            From git push to PR quality gate verification in under 500 milliseconds, with zero overhead on developer workstations.
          </p>
        </div>

        {/* 4-Stage Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {steps.map((item, idx) => (
            <div
              key={idx}
              className="relative flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0e15] p-6 shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2.5">
                    {item.icon}
                  </div>
                  <span className="font-mono text-xs font-bold text-zinc-400 dark:text-zinc-600">
                    STAGE {item.step}
                  </span>
                </div>

                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/60 space-y-1.5">
                {item.details.map((detail, dIdx) => (
                  <div key={dIdx} className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                    <span className="h-1 w-1 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" />
                    <span className="truncate">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
